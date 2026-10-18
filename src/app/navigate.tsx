import Mapbox from '@rnmapbox/maps';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedButton } from '../components/AnimatedButton';
import { LocateButton } from '../components/LocateButton';
import { MapStyleSwitcher } from '../components/MapStyleSwitcher';
import { NextTurn } from '../components/NextTurn';
import { DEFAULT_CENTER, TripMap } from '../components/TripMap';
import { haversine } from '../services/geo';
import { recordTrip } from '../services/history';
import { requestNavigationPermissions, startTracking, stopTracking } from '../services/location';
import { bearing, pathLength } from '../services/routeTools';
import { getQuickLocation } from '../services/whereAmI';
import { useMapPrefs } from '../store/mapPrefs';
import { useTripStore } from '../store/tripStore';
import { colors, radius } from '../theme/colors';
import type { LngLat } from '../types';
import { cardinal, formatClock, formatDistance, formatDuration } from '../utils/format';

export default function Navigate() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [ready, setReady] = useState(false);
  const [myStart, setMyStart] = useState<LngLat | null>(null);
  const [follow, setFollow] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const styleKey = useMapPrefs((s) => s.styleKey);
  const stops = useTripStore((s) => s.stops);
  const route = useTripStore((s) => s.route);
  const position = useTripStore((s) => s.position);
  const heading = useTripStore((s) => s.heading);
  const navigating = useTripStore((s) => s.navigating);
  const wrongWay = useTripStore((s) => s.wrongWay);
  const rerouteStamp = useTripStore((s) => s.rerouteStamp);
  const moves = useTripStore((s) => s.moves);
  const etas = useTripStore((s) => s.etas);
  const loading = useTripStore((s) => s.loading);
  const error = useTripStore((s) => s.error);
  const startNavigation = useTripStore((s) => s.startNavigation);
  const stopNavigation = useTripStore((s) => s.stopNavigation);
  const markArrived = useTripStore((s) => s.markArrived);

  const pending = useMemo(() => stops.filter((s) => s.status === 'pending'), [stops]);
  const next = pending[0];
  const me = position ?? myStart;
  const finished = !navigating && pending.length === 0;

  const roadToNext = route?.legs[0] && route.legs[0].length > 1 ? pathLength(route.legs[0]) : null;
  const straightToNext = position && next ? haversine(position, next.coord) : null;
  const distanceToNext = roadToNext ?? straightToNext;
  const nextBearing = position && next ? bearing(position, next.coord) : null;

  // Opens the map straight away and starts the route in the background.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await requestNavigationPermissions();
      if (!ok) {
        Alert.alert('Location needed', 'Turn on location permission to navigate.');
        router.back();
        return;
      }
      const start = useTripStore.getState().position ?? (await getQuickLocation());
      if (cancelled) return;
      setMyStart(start);
      setReady(true);
      startTracking().catch(() => {});
      await startNavigation();
    })();

    return () => {
      cancelled = true;
      stopTracking();
      stopNavigation();
    };
  }, []);

  // Stop GPS once the whole trip is complete.
  useEffect(() => {
    if (finished) stopTracking();
  }, [finished]);

  // While following, the camera moves to each fix and turns to face your heading.
  useEffect(() => {
    if (!follow || !position) return;
    cameraRef.current?.setCamera({
      centerCoordinate: position,
      ...(heading >= 0 ? { heading } : {}),
      animationDuration: 700,
    } as any);
  }, [position, heading, follow]);

  // Shows a short message when the route has been updated. No line is drawn for it.
  useEffect(() => {
    if (!rerouteStamp) return;
    setToast('Route updated');
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [rerouteStamp]);

  // A finger drag stops following.
  const onRegionWillChange = (e: any) => {
    if (e?.properties?.isUserInteraction) setFollow(false);
  };

  const recenter = async () => {
    setLocating(true);
    try {
      const pos = position ?? (await getQuickLocation());
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

  // Saves the trip, then clears the stops so the next plan starts fresh.
  const finish = async () => {
    setSaving(true);
    try {
      await recordTrip(finished ? 'completed' : 'ended');
      useTripStore.getState().clear();
      router.back();
    } catch (e: any) {
      Alert.alert('Trip not saved', `${e.message}\n\nThe trip stays on screen so you can try again.`);
    } finally {
      setSaving(false);
    }
  };

  const arrowHeading = follow ? 0 : heading;
  const rotation = nextBearing !== null ? (`${Math.round(nextBearing)}deg` as `${number}deg`) : '0deg';

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
          heading={arrowHeading}
          moves={moves}
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
        <NextTurn />
        {wrongWay && (
          <View style={styles.warn}>
            <Text style={styles.warnText}>Wrong direction. Rerouting…</Text>
          </View>
        )}
        {toast && !wrongWay && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
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
            <Text style={styles.title}>Trip complete</Text>
            <Text style={styles.hint}>You visited every stop.</Text>
          </>
        ) : (
          <>
            <Text style={styles.kicker}>NEXT STOP</Text>
            <Text style={styles.title} numberOfLines={2}>
              {next ? next.name : 'Locating…'}
            </Text>

            {nextBearing !== null && straightToNext !== null && (
              <View style={styles.dirRow}>
                <Text style={[styles.dirArrow, { transform: [{ rotate: rotation }] }]}>▲</Text>
                <Text style={styles.dirText}>
                  {cardinal(nextBearing)} · {formatDistance(straightToNext)} in a straight line
                </Text>
              </View>
            )}

            {loading && !route && <Text style={styles.hint}>Finding the route…</Text>}

            <View style={styles.statRow}>
              <View>
                <Text style={styles.statLabel}>Distance</Text>
                <Text style={styles.statValue}>{distanceToNext !== null ? formatDistance(distanceToNext) : '—'}</Text>
              </View>
              <View>
                <Text style={styles.statLabel}>Arrive</Text>
                <Text style={styles.statValue}>{formatClock(next ? etas[next.id] : undefined)}</Text>
              </View>
              <View>
                <Text style={styles.statLabel}>Left</Text>
                <Text style={styles.statValue}>{pending.length}</Text>
              </View>
            </View>

            {route && (
              <Text style={styles.hint}>
                Trip total {formatDistance(route.distanceM)} · {formatDuration(route.durationS)}
              </Text>
            )}
            {error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.sub}>Upcoming</Text>
            <ScrollView style={styles.list} nestedScrollEnabled>
              {pending.map((s, i) => (
                <View key={s.id} style={styles.listRow}>
                  <Text style={[styles.arrow, { color: moves[s.id] === '▲' ? colors.up : colors.down }]}>
                    {moves[s.id] ?? ''}
                  </Text>
                  <Text style={styles.listName} numberOfLines={1}>
                    {i + 1}. {s.name}
                  </Text>
                  <Text style={styles.listTime}>{formatClock(etas[s.id])}</Text>
                </View>
              ))}
            </ScrollView>

            <AnimatedButton
              label="Mark as visited"
              variant="ghost"
              onPress={markArrived}
              disabled={!next}
              style={{ marginTop: 12 }}
            />
          </>
        )}

        <AnimatedButton
          label={finished ? (saving ? 'Saving…' : 'Done') : 'End navigation'}
          variant={finished ? 'primary' : 'danger'}
          disabled={saving}
          onPress={finish}
          style={{ marginTop: 10 }}
        />
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  top: { position: 'absolute', top: 12, left: 12, right: 12 },
  warn: { backgroundColor: colors.warn, borderRadius: radius.md, padding: 10, marginTop: 8 },
  warnText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' },
  toast: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.routeActive,
  },
  toastText: { color: colors.text, textAlign: 'center', fontWeight: '600' },
  locate: { position: 'absolute', top: 170, right: 16 },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    padding: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kicker: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  dirRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  dirArrow: { color: colors.stopNext, fontSize: 22 },
  dirText: { color: colors.text, fontWeight: '600' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  statLabel: { color: colors.muted, fontSize: 11 },
  statValue: { color: colors.accent, fontSize: 18, fontWeight: '700', marginTop: 2 },
  sub: { color: colors.text, fontWeight: '700', marginTop: 12 },
  list: { maxHeight: 120, marginTop: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 6 },
  arrow: { width: 16, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  listName: { color: colors.text, flex: 1 },
  listTime: { color: colors.primary, fontWeight: '600' },
  hint: { color: colors.muted, marginTop: 4, fontSize: 12 },
  error: { color: colors.danger, marginTop: 6, fontSize: 12 },
});