import { Ionicons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { BackButton } from '../components/BackButton';
import { LocateButton } from '../components/LocateButton';
import { MapStyleSwitcher } from '../components/MapStyleSwitcher';
import { DEFAULT_CENTER, TripMap } from '../components/TripMap';
import { haversine } from '../services/geo';
import { recordTrip } from '../services/history';
import { requestNavigationPermissions, startTracking, stopTracking } from '../services/location';
import { bearing, pathLength } from '../services/routeTools';
import { getQuickLocation } from '../services/whereAmI';
import { useMapPrefs } from '../store/mapPrefs';
import { useTripStore } from '../store/tripStore';
import { cardStyle, colors, radius, shadow } from '../theme/colors';
import { fonts } from '../theme/font';
import type { LngLat } from '../types';
import { cardinal, formatClock, formatDistance, formatDuration } from '../utils/format';

// Distances under 1 km show in meters, which is easier to read for turns.
function shortDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : formatDistance(m);
}

// Picks a compact arrow icon for a routing instruction.
function turnIcon(text: string): keyof typeof Ionicons.glyphMap {
  if (/u-?turn/i.test(text)) return 'reload';
  if (/left/i.test(text)) return 'arrow-back';
  if (/right/i.test(text)) return 'arrow-forward';
  return 'arrow-up';
}

export default function Navigate() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const insets = useSafeAreaInsets();
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
  const stepIndex = useTripStore((s) => s.stepIndex);
  const startNavigation = useTripStore((s) => s.startNavigation);
  const stopNavigation = useTripStore((s) => s.stopNavigation);
  const markArrived = useTripStore((s) => s.markArrived);

  const pending = useMemo(() => stops.filter((s) => s.status === 'pending'), [stops]);
  const next = pending[0];
  const me = position ?? myStart;
  const finished = !navigating && pending.length === 0;

  // Current turn instruction, shown inside the bottom sheet.
  const steps = route?.steps ?? [];
  const step = navigating ? steps[stepIndex] : undefined;
  const after = steps[stepIndex + 1];
  const turnDist = step && position ? haversine(position, step.coord) : null;

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
          routeMode={navigating ? 'navigate' : 'plan'}
          me={me}
          heading={arrowHeading}
          moves={moves}
          candidate={null}
          showNames
          onRegionWillChange={onRegionWillChange}
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primaryStrong} />
          <Text style={styles.hint}>Finding your location…</Text>
        </View>
      )}

      <BackButton />

      {/* Compact top strip: warnings only */}
      <View style={[styles.top, { top: insets.top + 6 }]}>
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

      <View style={[styles.side, { top: insets.top + 6 }]}>
        <MapStyleSwitcher />
        <LocateButton onPress={recenter} busy={locating} />
      </View>

      {/* Compact bottom sheet — everything in one small card */}
      <MotiView
        key={finished ? 'done' : next?.id ?? 'none'}
        from={{ opacity: 0, translateY: 40, scale: 0.98 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: 'timing', duration: 220 }}
        style={[styles.sheet, { bottom: insets.bottom + 12 }]}
      >
        {finished ? (
          <>
            <Text style={styles.title}>Trip complete</Text>
            <Text style={styles.hint}>You visited every stop.</Text>
            <AnimatedButton
              label={saving ? 'Saving…' : 'Done'}
              variant="primary"
              disabled={saving}
              onPress={finish}
              style={{ marginTop: 12 }}
            />
          </>
        ) : (
          <>
            {/* Turn instruction */}
            {step && turnDist !== null && (
              <View style={styles.turnRow}>
                <View style={styles.turnIcon}>
                  <Ionicons name={turnIcon(step.text)} size={18} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.turnText} numberOfLines={1}>
                    {step.text}
                  </Text>
                  {after && (
                    <Text style={styles.then} numberOfLines={1}>
                      Then: {after.text}
                    </Text>
                  )}
                </View>
                <Text style={styles.turnDist}>{shortDistance(turnDist)}</Text>
              </View>
            )}

            {/* Next stop */}
            <Text style={styles.kicker}>NEXT STOP</Text>
            <View style={styles.stopRow}>
              <Text style={styles.title} numberOfLines={1}>
                {next ? next.name : 'Locating…'}
              </Text>
              {nextBearing !== null && (
                <View style={styles.bearing}>
                  <Ionicons name="navigate" size={12} color={colors.accent} style={{ transform: [{ rotate: rotation }] }} />
                  <Text style={styles.bearingText}>{cardinal(nextBearing)}</Text>
                </View>
              )}
            </View>

            {loading && !route && <Text style={styles.hint}>Finding the route…</Text>}

            {/* Compact stats */}
            <View style={styles.statRow}>
              <Stat label="Distance" value={distanceToNext !== null ? formatDistance(distanceToNext) : '—'} />
              <Stat label="Arrive" value={formatClock(next ? etas[next.id] : undefined)} />
              <Stat label="Left" value={String(pending.length)} />
            </View>

            {route && (
              <Text style={styles.hint}>
                Trip total {formatDistance(route.distanceM)} · {formatDuration(route.durationS)}
              </Text>
            )}
            {error && <Text style={styles.error}>{error}</Text>}

            {/* Upcoming, capped small */}
            {pending.length > 1 && (
              <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {pending.slice(1).map((s, i) => (
                  <View key={s.id} style={styles.listRow}>
                    <Text style={[styles.arrow, { color: moves[s.id] === '▲' ? colors.up : colors.down }]}>
                      {moves[s.id] ?? ''}
                    </Text>
                    <Text style={styles.listName} numberOfLines={1}>
                      {i + 2}. {s.name}
                    </Text>
                    <Text style={styles.listTime}>{formatClock(etas[s.id])}</Text>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Two compact icon buttons */}
            <View style={styles.buttonRow}>
              <AnimatedButton
                label="Visited"
                variant="ghost"
                onPress={markArrived}
                disabled={!next}
                icon={<Ionicons name="checkmark" size={18} color={colors.text} />}
                style={{ flex: 1 }}
              />
              <AnimatedButton
                label={saving ? 'Saving…' : 'End'}
                variant="danger"
                disabled={saving}
                onPress={finish}
                icon={<Ionicons name="stop-circle" size={18} color="#FFFFFF" />}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </MotiView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  top: { position: 'absolute', left: 64, right: 68 },
  warn: { backgroundColor: colors.danger, borderRadius: radius.md, padding: 8 },
  warnText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center', fontSize: 12 },
  toast: { ...cardStyle, borderRadius: radius.md, padding: 8 },
  toastText: { color: colors.text, textAlign: 'center', fontWeight: '600', fontSize: 12 },
  side: { position: 'absolute', right: 12, gap: 10, alignItems: 'center' },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  turnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 10,
  },
  turnIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  then: { color: colors.muted, fontSize: 11, marginTop: 1 },
  turnDist: { color: colors.accent, fontWeight: '800', fontSize: 14, fontFamily: fonts.bold },
  kicker: { color: colors.accent, letterSpacing: 2, fontSize: 10, fontWeight: '700', fontFamily: fonts.semibold },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', flex: 1, fontFamily: fonts.bold },
  bearing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bearingText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statLabel: { color: colors.muted, fontSize: 10 },
  statValue: { color: colors.accent, fontSize: 15, fontWeight: '800', marginTop: 1, fontFamily: fonts.bold },
  list: { maxHeight: 64, marginTop: 8 },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 6 },
  arrow: { width: 14, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  listName: { color: colors.text, flex: 1, fontSize: 12 },
  listTime: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  buttonRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  hint: { color: colors.muted, marginTop: 4, fontSize: 11 },
  error: { color: colors.danger, marginTop: 4, fontSize: 11 },
});
