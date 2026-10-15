import Mapbox from '@rnmapbox/maps';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedButton } from '../components/AnimatedButton';
import { LocateButton } from '../components/LocateButton';
import { MapStyleSwitcher } from '../components/MapStyleSwitcher';
import { SearchBar } from '../components/SearchBar';
import { DEFAULT_CENTER, TripMap } from '../components/TripMap';
import { reverseGeocode, type PlaceResult } from '../services/mapbox';
import { getMyLocation } from '../services/whereAmI';
import { useMapPrefs } from '../store/mapPrefs';
import { useTripStore, type OptimizeResult } from '../store/tripStore';
import { colors, radius } from '../theme/colors';
import type { LngLat } from '../types';
import { formatDistance, formatDuration } from '../utils/format';

function describeOptimize(r: NonNullable<OptimizeResult>): string {
  const saved = r.beforeCost - r.afterCost;
  if (saved < 1) return 'Already in the best order';
  return r.metric === 'time'
    ? `Optimized: saves ${formatDuration(saved)}`
    : `Optimized: saves ${formatDistance(saved)}`;
}

export default function Plan() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const tapGuard = useRef(0);
  const addTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [me, setMe] = useState<LngLat | null>(null);
  const [candidate, setCandidate] = useState<PlaceResult | null>(null);

  const styleKey = useMapPrefs((s) => s.styleKey);
  const stops = useTripStore((s) => s.stops);
  const route = useTripStore((s) => s.route);
  const loading = useTripStore((s) => s.loading);
  const optimizing = useTripStore((s) => s.optimizing);
  const optimizeResult = useTripStore((s) => s.optimizeResult);
  const error = useTripStore((s) => s.error);
  const addStop = useTripStore((s) => s.addStop);
  const renameStop = useTripStore((s) => s.renameStop);
  const removeStop = useTripStore((s) => s.removeStop);
  const clear = useTripStore((s) => s.clear);
  const optimize = useTripStore((s) => s.optimize);
  const previewRoute = useTripStore((s) => s.previewRoute);
  const moves = useTripStore((s) => s.moves);

  const pending = useMemo(() => stops.filter((s) => s.status === 'pending'), [stops]);

  // Center on your location once the map is ready.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pos = await getMyLocation();
      if (cancelled || !pos) return;
      setMe(pos);
      cameraRef.current?.setCamera({ centerCoordinate: pos, zoomLevel: 15, animationDuration: 900 });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const focus = useCallback((coord: LngLat, zoom = 15) => {
    cameraRef.current?.setCamera({ centerCoordinate: coord, zoomLevel: zoom, animationDuration: 700 });
  }, []);

  const recenter = useCallback(async () => {
    const pos = await getMyLocation();
    if (!pos) return;
    setMe(pos);
    focus(pos, 16);
  }, [focus]);

  // Adds the pin at once, then replaces the placeholder with the place name.
  const addPinned = useCallback(
    (coord: LngLat) => {
      const id = addStop(coord, 'Locating…');
      reverseGeocode(coord)
        .then((name) => renameStop(id, name ?? 'Pinned location'))
        .catch(() => renameStop(id, 'Pinned location'));
    },
    [addStop, renameStop]
  );

  const onMapPress = useCallback(
    (e: any) => {
      if (Date.now() - tapGuard.current < 500) return; // ignore the tap that removed a pin
      setCandidate(null);
      const coord = e.geometry.coordinates as LngLat;
      if (addTimer.current) clearTimeout(addTimer.current);
      addTimer.current = setTimeout(() => addPinned(coord), 250);
    },
    [addPinned]
  );

  const onStopPress = useCallback(
    (id: string) => {
      tapGuard.current = Date.now();
      if (addTimer.current) clearTimeout(addTimer.current);
      addTimer.current = null;
      removeStop(id);
    },
    [removeStop]
  );

  const onSelectPlace = useCallback(
    (place: PlaceResult) => {
      setCandidate(place);
      if (place.coord) focus(place.coord);
    },
    [focus]
  );

  const confirmCandidate = () => {
    if (!candidate?.coord) return;
    addStop(candidate.coord, candidate.name);
    setCandidate(null);
  };

  return (
    <View style={styles.root}>
      <TripMap
        cameraRef={cameraRef}
        styleKey={styleKey}
        initialCenter={DEFAULT_CENTER}
        stops={stops}
        moves={moves}
        route={route}
        routeMode="plan"
        me={me}
        candidate={candidate?.coord ?? null}
        showNames
        onPress={onMapPress}
        onStopPress={onStopPress}
      />

      <View style={styles.top}>
        <SearchBar near={me} onSelect={onSelectPlace} />
        <View style={{ marginTop: 8 }}>
          <MapStyleSwitcher />
        </View>
      </View>

      <View style={styles.locate}>
        <LocateButton onPress={recenter} />
      </View>

      <MotiView
        from={{ opacity: 0, translateY: 80 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', damping: 18 }}
        style={styles.sheet}
      >
        {candidate ? (
          <>
            <Text style={styles.title}>{candidate.name}</Text>
            {!!candidate.address && <Text style={styles.hint}>{candidate.address}</Text>}
            <AnimatedButton label="Add to route" onPress={confirmCandidate} style={{ marginTop: 14 }} />
            <AnimatedButton label="Cancel" variant="ghost" onPress={() => setCandidate(null)} style={{ marginTop: 10 }} />
          </>
        ) : (
          <>
            <Text style={styles.title}>
              {pending.length} stop{pending.length === 1 ? '' : 's'} planned
            </Text>
            <Text style={styles.hint}>{me ? 'Route starts from your location' : 'Turn on location to start from you'}</Text>

            {route && (
              <Text style={styles.accent}>
                {formatDistance(route.distanceM)} · {formatDuration(route.durationS)}
              </Text>
            )}
            {optimizeResult && <Text style={styles.good}>{describeOptimize(optimizeResult)}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}

            {pending.length > 0 && (
              <ScrollView style={styles.list} nestedScrollEnabled>
                {pending.map((s, i) => (
                  <View key={s.id} style={styles.listRow}>
                    <Text style={[styles.arrow, { color: moves[s.id] === '▲' ? colors.up : colors.down }]}>
                      {moves[s.id] ?? ''}
                    </Text>
                    <Text style={styles.item} numberOfLines={1}>
                      {i + 1}. {s.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <Text style={styles.hint}>Search a place or tap the map. Tap a pin to remove it.</Text>

            <View style={styles.row}>
              <AnimatedButton
                label={optimizing ? 'Optimizing…' : 'Optimize'}
                variant="ghost"
                onPress={optimize}
                disabled={pending.length < 2 || optimizing}
                style={{ flex: 1 }}
              />
              <AnimatedButton
                label={loading ? 'Routing…' : 'Preview'}
                onPress={previewRoute}
                disabled={!pending.length || loading}
                style={{ flex: 1 }}
              />
            </View>
            <AnimatedButton
              label="Start navigation"
              onPress={() => router.push('/navigate')}
              disabled={!pending.length}
              style={{ marginTop: 10 }}
            />
            <AnimatedButton label="Clear all" variant="danger" onPress={clear} style={{ marginTop: 10 }} />
          </>
        )}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', top: 12, left: 12, right: 12 },
  locate: { position: 'absolute', top: 180, right: 16 },
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
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  accent: { color: colors.accent, marginTop: 6, fontWeight: '600' },
  good: { color: colors.primary, marginTop: 6, fontWeight: '600' },
  hint: { color: colors.muted, marginTop: 6 },
  error: { color: colors.danger, marginTop: 6 },
  list: { maxHeight: 130, marginTop: 10 },
  item: { color: colors.text},
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  arrow: { width: 16, fontSize: 14, fontWeight: '800', textAlign: 'center' },
});