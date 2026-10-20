import Mapbox from '@rnmapbox/maps';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedButton } from '../components/AnimatedButton';
import { LocateButton } from '../components/LocateButton';
import { MapStyleSwitcher } from '../components/MapStyleSwitcher';
import { SearchBar } from '../components/SearchBar';
import { DEFAULT_CENTER, TripMap } from '../components/TripMap';
import { reverseGeocode, VEHICLES, type VehicleKey } from '../services/geoapify';
import type { PlaceResult } from '../services/mapbox';
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
  const alternatives = useTripStore((s) => s.alternatives);
  const selectedAltId = useTripStore((s) => s.selectedAltId);
  const vehicle = useTripStore((s) => s.vehicle);
  const loading = useTripStore((s) => s.loading);
  const optimizing = useTripStore((s) => s.optimizing);
  const optimizeResult = useTripStore((s) => s.optimizeResult);
  const error = useTripStore((s) => s.error);
  const moves = useTripStore((s) => s.moves);
  const addStop = useTripStore((s) => s.addStop);
  const renameStop = useTripStore((s) => s.renameStop);
  const removeStop = useTripStore((s) => s.removeStop);
  const clear = useTripStore((s) => s.clear);
  const optimize = useTripStore((s) => s.optimize);
  const setVehicle = useTripStore((s) => s.setVehicle);
  const selectAlternative = useTripStore((s) => s.selectAlternative);
  const previewRoute = useTripStore((s) => s.previewRoute);

  const pending = useMemo(() => stops.filter((s) => s.status === 'pending'), [stops]);

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
      if (Date.now() - tapGuard.current < 500) return;
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

  const vehicleNote = VEHICLES[vehicle].note;

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
        alternatives={alternatives}
        selectedAltId={selectedAltId}
        onAlternativePress={selectAlternative}
        onPress={onMapPress}
        onStopPress={onStopPress}
      />

      <View style={styles.top}>
        <SearchBar near={me} onSelect={onSelectPlace} />
        <View style={{ marginTop: 8 }}>
          <MapStyleSwitcher />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {(Object.keys(VEHICLES) as VehicleKey[]).map((k) => {
            const on = k === vehicle;
            return (
              <Pressable key={k} onPress={() => setVehicle(k)} style={[styles.chip, on && styles.chipOn]}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{VEHICLES[k].label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {pending.length} stop{pending.length === 1 ? '' : 's'} planned
            </Text>
            <Text style={styles.hint}>{me ? 'Route starts from your location' : 'Turn on location to start from you'}</Text>
            {vehicleNote && <Text style={styles.note}>{vehicleNote}</Text>}

            {alternatives.length > 0 && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardScroll} contentContainerStyle={styles.cardRow}>
                  {alternatives.map((a, i) => {
                    const on = a.id === selectedAltId;
                    return (
                      <Pressable key={a.id} onPress={() => selectAlternative(a.id)} style={[styles.card, on && styles.cardOn]}>
                        <Text style={styles.cardTitle}>
                          {a.label}
                          {i === 0 ? ' · quickest' : ''}
                        </Text>
                        <Text style={styles.cardMeta}>
                          {formatDistance(a.distanceM)} · {formatDuration(a.durationS)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Text style={styles.hint}>Tap a light route on the map or a card to choose it.</Text>
              </>
            )}

            {optimizeResult && <Text style={styles.good}>{describeOptimize(optimizeResult)}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}

            {pending.length > 0 && (
              <View style={styles.list}>
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
              </View>
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
                label={loading ? 'Finding routes…' : 'Show routes'}
                onPress={() => previewRoute()}
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
          </ScrollView>
        )}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', top: 12, left: 12, right: 12 },
  chipScroll: { flexGrow: 0, marginTop: 8 },
  chipRow: { gap: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: colors.bg },
  locate: { position: 'absolute', top: 170, right: 16 },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    maxHeight: '55%',
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  hint: { color: colors.muted, marginTop: 6 },
  note: { color: colors.warn, marginTop: 6, fontSize: 12 },
  good: { color: colors.primary, marginTop: 8, fontWeight: '600' },
  error: { color: colors.danger, marginTop: 6 },
  cardScroll: { flexGrow: 0, marginTop: 12 },
  cardRow: { gap: 8 },
  card: {
    padding: 12,
    minWidth: 150,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  cardOn: { borderColor: colors.routeActive },
  cardTitle: { color: colors.text, fontWeight: '700' },
  cardMeta: { color: colors.accent, marginTop: 4, fontWeight: '600' },
  list: { marginTop: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  arrow: { width: 16, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  item: { color: colors.text, flex: 1 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
});