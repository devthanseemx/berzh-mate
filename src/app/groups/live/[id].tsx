import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../../components/Toast';
import { AnimatedButton } from '../../../components/AnimatedButton';
import { MapStyleSwitcher } from '../../../components/MapStyleSwitcher';
import { supabase } from '../../../services/auth';
import { currentUserId, getGroup, sendLocation, setSharing } from '../../../services/groups';
import { requestNavigationPermissions } from '../../../services/location';
import { useMapPrefs } from '../../../store/mapPrefs';
import { colors, radius, shadow } from '../../../theme/colors';
import { BackButton } from '../../../components/BackButton';
import { MAP_STYLES } from '../../../theme/mapStyles';
import type { LngLat } from '../../../types';

const PALETTE = ['#2DD4BF', '#F59E0B', '#F472B6', '#38BDF8', '#A78BFA', '#34D399'];
const DEFAULT_CENTER: LngLat = [81.7, 7.71];

type Loc = { lat: number; lng: number; at: string };
type Member = { id: string; name: string; user_id: string | null };

// A dot that pulses outward, so each person is easy to spot.
function PulseDot({ color }: { color: string }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(2.2, { duration: 1400 }), -1, false);
  }, []);
  const ring = useAnimatedStyle(() => ({
    transform: [{ scale: s.value }],
    opacity: 1.6 - s.value * 0.7,
  }));
  return (
    <View style={styles.dotWrap}>
      <Animated.View style={[styles.ring, { backgroundColor: color }, ring]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

export default function LiveGroup() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const styleKey = useMapPrefs((s) => s.styleKey);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const fitted = useRef(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [locs, setLocs] = useState<Record<string, Loc>>({});
  const [sharing, setSharingState] = useState(false);
  const [ended, setEnded] = useState(false);
  const [, setTick] = useState(0);

  // Load the members and their last known positions, then listen for live changes.
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const uid = await currentUserId();
      setMe(uid);
      const { group, members: ms } = await getGroup(id);
      setMembers(ms.map((m) => ({ id: m.id, name: m.name || m.email, user_id: m.user_id })));
      const mine = ms.find((m) => m.user_id === uid);
      setMyMemberId(mine?.id ?? null);
      setSharingState(!!mine?.sharing);
      if (group.status === 'finished') setEnded(true);

      const { data: existing } = await supabase
        .from('group_locations')
        .select('member_id,lat,lng,updated_at')
        .eq('group_id', id);
      const map: Record<string, Loc> = {};
      (existing ?? []).forEach((r: any) => {
        map[r.member_id] = { lat: Number(r.lat), lng: Number(r.lng), at: r.updated_at };
      });
      setLocs(map);

      channel = supabase
        .channel(`live-${id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_locations', filter: `group_id=eq.${id}` },
          (p: any) => {
            if (p.eventType === 'DELETE') {
              setLocs((prev) => {
                const next = { ...prev };
                delete next[p.old.member_id];
                return next;
              });
            } else {
              const r = p.new;
              setLocs((prev) => ({ ...prev, [r.member_id]: { lat: Number(r.lat), lng: Number(r.lng), at: r.updated_at } }));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${id}` },
          (p: any) => {
            if (p.new.status === 'finished') setEnded(true);
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [id]);

  // Trip ended by the owner: stop sharing and leave the map.
  useEffect(() => {
    if (!ended) return;
    setSharingState(false);
    setLocs({});
    Alert.alert('Trip ended', 'The owner ended this trip, so live location has stopped.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [ended]);

  // While sharing, send the position to the server on each move.
  useEffect(() => {
    if (!sharing || ended) return;
    let cancelled = false;
    let sub: Location.LocationSubscription | null = null;

    (async () => {
      const ok = await requestNavigationPermissions();
      if (!ok) {
        setSharingState(false);
        Alert.alert('Location needed', 'Allow location to share it with the group.');
        return;
      }
      const s = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        (loc) => {
          sendLocation(id, loc.coords.latitude, loc.coords.longitude).catch(() => {});
        }
      );
      if (cancelled) s.remove();
      else sub = s;
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [sharing, ended, id]);

  // Stop sharing when you leave the screen, since background sharing isn't active yet.
  useEffect(() => {
    return () => {
      setSharing(id, false).catch(() => {});
    };
  }, [id]);

  // Refresh the "last seen" times every 15 seconds.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  // Fit the camera to everyone once positions arrive.
  useEffect(() => {
    const pts = Object.values(locs);
    if (!pts.length || fitted.current) return;
    fitted.current = true;
    const lngs = pts.map((p) => p.lng);
    const lats = pts.map((p) => p.lat);
    cameraRef.current?.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      80,
      700
    );
  }, [locs]);

  const toggleSharing = async () => {
    const next = !sharing;
    try {
      await setSharing(id, next);
      setSharingState(next);
      toast.success(next ? 'Sharing on' : 'Sharing off', next ? 'Your location is visible to the trip.' : 'Your location is hidden.');
    } catch (e: any) {
      toast.error('Could not update', `Sharing change failed: ${e.message}`);
    }
  };

  const ageText = (at: string) => {
    const mins = Math.round((Date.now() - Date.parse(at)) / 60000);
    return mins < 1 ? 'live' : `${mins} min ago`;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BackButton />
      <View style={{ flex: 1 }}>
        <Mapbox.MapView
          style={{ flex: 1 }}
          styleURL={MAP_STYLES[styleKey].url}
          logoEnabled={false}
          attributionEnabled={false}
          scaleBarEnabled={false}
          surfaceView
        >
          <Mapbox.Camera ref={cameraRef} defaultSettings={{ centerCoordinate: DEFAULT_CENTER, zoomLevel: 13 }} />
          {Object.entries(locs).map(([memberId, l]) => {
            const idx = members.findIndex((m) => m.id === memberId);
            return (
              <Mapbox.PointAnnotation key={memberId} id={memberId} coordinate={[l.lng, l.lat]}>
                <PulseDot color={PALETTE[(idx < 0 ? 0 : idx) % PALETTE.length]} />
              </Mapbox.PointAnnotation>
            );
          })}
        </Mapbox.MapView>

        <View style={[styles.top, { top: insets.top + 6 }]}>
          <MapStyleSwitcher />
        </View>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>Group on the map</Text>
        <ScrollView style={{ maxHeight: 150 }}>
          {members.map((m, i) => {
            const l = locs[m.id];
            return (
              <View key={m.id} style={styles.row}>
                <View style={[styles.swatch, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
                <Text style={styles.name} numberOfLines={1}>
                  {m.name} {m.id === myMemberId ? '(you)' : ''}
                </Text>
                <Text style={styles.meta}>{l ? ageText(l.at) : 'not sharing'}</Text>
              </View>
            );
          })}
        </ScrollView>

        {myMemberId ? (
          <AnimatedButton
            label={sharing ? 'Stop sharing my location' : 'Share my location'}
            variant={sharing ? 'danger' : 'primary'}
            disabled={ended}
            onPress={toggleSharing}
            style={{ marginTop: 10 }}
          />
        ) : (
          <Text style={styles.meta}>Sign in with the Gmail address the owner added to share your location.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', left: 12, right: 12, alignItems: 'flex-end' },
  dotWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 22, height: 22, borderRadius: 11 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF' },
  sheet: {
    padding: 16,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 0,
    ...shadow.float,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  name: { color: colors.text, flex: 1, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12 },
});