import Mapbox from '@rnmapbox/maps';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { AnimatedButton } from '../components/AnimatedButton';
import { LocateButton } from '../components/LocateButton';
import { MapStyleSwitcher } from '../components/MapStyleSwitcher';
import { DEFAULT_CENTER, TripMap } from '../components/TripMap';
import { haversine } from '../services/geo';
import { requestNavigationPermissions, startTracking, stopTracking } from '../services/location';
import { getMyLocation } from '../services/whereAmI';
import { useMapPrefs } from '../store/mapPrefs';
import { useTripStore } from '../store/tripStore';
import { colors, radius } from '../theme/colors';
import type { LngLat } from '../types';
import { formatDistance, formatDuration } from '../utils/format';

export default function Navigate() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [ready, setReady] = useState(false);
  const [myStart, setMyStart] = useState<LngLat | null>(null);
  const [follow, setFollow] = useState(true); // true = camera tracks you; false = you're exploring
  const [locating, setLocating] = useState(false);

  const styleKey = useMapPrefs((s) => s.styleKey);
  const stops = useTripStore((s) => s.stops);
  const route = useTripStore((s) => s.route);
  const position = useTripStore((s) => s.position);
  const navigating = useTripStore((s) => s.navigating);
  const startNavigation = useTripStore((s) => s.startNavigation);
  const stopNavigation = useTripStore((s) => s.stopNavigation);

  const pending = useMemo(() => stops.filter((s) => s.status === 'pending'), [stops]);
  const next = pending[0];
  const me = position ?? myStart;
  const distToNext = position && next ? haversine(position, next.coord) : null;

  // Wait for the first location before showing the map, so it never opens on the world view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await requestNavigationPermissions();
      if (!ok) {
        Alert.alert('Location needed', 'Turn on location permission to navigate.');
        router.back();
        return;
      }
      const start = await getMyLocation();
      if (cancelled) return;
      setMyStart(start);
      setReady(true);
      await startTracking();
      await startNavigation();
    })();

    return () => {
      cancelled = true;
      stopTracking();
      stopNavigation();
    };
  }, []);

  // While following, move the camera to each new position. Zoom and tilt are left alone.
  useEffect(() => {
    if (follow && position) {
      cameraRef.current?.setCamera({ centerCoordinate: position, animationDuration: 700 });
    }
  }, [position, follow]);

  // A finger drag means the user is exploring, so stop following.
  const onRegionWillChange = useCallback((e: any) => {
    if (e?.properties?.isUserInteraction) setFollow(false);
  }, []);

  const recenter = async () => {
    setLocating(true);
    try {
      const pos = position ?? (await getMyLocation());
      if (!pos) {
        Alert.alert('Location unavailable', 'Turn on GPS and try again.');
        return;
      }
      setFollow(true);
      cameraRef.current?.setCamera({ centerCoordinate: pos, zoomLevel: 16, pitch: 45, animationDuration: 600 });
    } finally {
      setLocating(false);
    }
  };

  const finished = !navigating && pending.length === 0;

  return (
    <View style={styles.root}>
      {ready ? (
        <TripMap
          cameraRef={cameraRef}
          styleKey={styleKey}
          initialCenter={myStart ?? DEFAULT_CENTER}
          stops={stops}
          route={route}
          routeMode="navigate"
          me={me}
          candidate={null}
          showNames
          onRegionWillChange={onRegionWillChange}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.hint}>Finding your location…</Text>
        </View>
      )}

      <View style={styles.top}>
        <MapStyleSwitcher />
      </View>

      <View style={styles.locate}>
        <LocateButton onPress={recenter} busy={locating} />
      </View>

      <MotiView
        key={finished ? 'done' : next?.id ?? 'none'}
        from={{ opacity: 0, translateY: 60 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18 }}
        style={styles.sheet}
      >
        {finished ? (
          <>
            <Text style={styles.title}>Route complete</Text>
            <Text style={styles.hint}>You visited every stop.</Text>
          </>
        ) : (
          <>
            <Text style={styles.kicker}>NEXT STOP</Text>
            <Text style={styles.title} numberOfLines={2}>
              {next ? next.name : 'Locating…'}
            </Text>
            <Text style={styles.accent}>
              {distToNext !== null ? `${formatDistance(distToNext)} away` : 'Waiting for GPS'}
            </Text>
            {route && (
              <Text style={styles.hint}>
                {formatDuration(route.durationS)} total · {pending.length} stop{pending.length === 1 ? '' : 's'} left
              </Text>
            )}
            {!follow && <Text style={styles.hint}>Map paused. Tap the locate button to follow again.</Text>}
          </>
        )}

        <AnimatedButton
          label={finished ? 'Done' : 'End navigation'}
          variant={finished ? 'primary' : 'danger'}
          onPress={() => router.back()}
          style={{ marginTop: 16 }}
        />
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  top: { position: 'absolute', top: 12, left: 12, right: 12 },
  locate: { position: 'absolute', top: 70, right: 16 },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kicker: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },
  accent: { color: colors.accent, marginTop: 4, fontWeight: '600' },
  hint: { color: colors.muted, marginTop: 4 },
});