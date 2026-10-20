import { Ionicons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { router, useLocalSearchParams } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { useConfirm } from '../../components/Confirm';
import { LocateButton } from '../../components/LocateButton';
import { MapStyleSwitcher } from '../../components/MapStyleSwitcher';
import { OptionSheet } from '../../components/OptionSheet';
import { SearchBar } from '../../components/SearchBar';
import { SavedPlacesSheet } from '../../components/SavedPlacesSheet';
import { DEFAULT_CENTER, TripMap } from '../../components/TripMap';
import { useToast } from '../../components/Toast';
import { VehicleIcon } from '../../components/vehicleIcons';
import { reverseGeocode, VEHICLES, type VehicleKey } from '../../services/geoapify';
import type { PlaceResult } from '../../services/mapbox';
import { getMyLocation } from '../../services/whereAmI';
import { useMapPrefs } from '../../store/mapPrefs';
import { useSavedPlaces, type SavedPlace } from '../../store/savedPlaces';
import { useTripStore, type OptimizeResult } from '../../store/tripStore';
import { cardStyle, colors, radius, shadow } from '../../theme/colors';
import { fonts } from '../../theme/font';
import type { LngLat, Stop } from '../../types';
import { formatDistance, formatDuration } from '../../utils/format';

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
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();
  const toast = useToast();
  // Deep-linked saved place from the Home strip: /plan?saved=<id>
  const { saved: savedParam } = useLocalSearchParams<{ saved?: string }>();

  const [me, setMe] = useState<LngLat | null>(null);
  const [candidate, setCandidate] = useState<PlaceResult | null>(null);
  const [vehOpen, setVehOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
  const savedPlaces = useSavedPlaces((s) => s.places);
  const savePlace = useSavedPlaces((s) => s.save);
  const removePlace = useSavedPlaces((s) => s.remove);

  // Reactive check — re-renders the bookmark state the moment a place is saved.
  const coordSaved = (c: LngLat | null) =>
    !!c && savedPlaces.some((p) => Math.abs(p.coord[0] - c[0]) < 1e-5 && Math.abs(p.coord[1] - c[1]) < 1e-5);
  const candidateSaved = coordSaved(candidate?.coord ?? null);

  const pending = useMemo(() => stops.filter((s) => s.status === 'pending'), [stops]);

  // A longer stop list opens the sheet fully, so everything stays visible.
  useEffect(() => {
    if (pending.length > 3) setExpanded(true);
  }, [pending.length]);

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

  // Saves the shown search result — asks Home / Work / place name first.
  const saveCandidate = () => {
    if (!candidate?.coord) return;
    if (coordSaved(candidate.coord)) {
      toast.info('Already saved', 'This place is in your saved places.');
      return;
    }
    setLabelOpen(true);
  };

  const saveWithLabel = (key: string) => {
    if (!candidate?.coord) return;
    const name = key === 'home' ? 'Home' : key === 'work' ? 'Work' : candidate.name;
    savePlace({ name, address: candidate.address ?? '', coord: candidate.coord });
    toast.success('Saved', `${name} is in your saved places.`);
  };

  // Bookmark on a pinned stop: tap to save it, tap again to remove it.
  const toggleStopSave = (s: Stop) => {
    const existing = savedPlaces.find(
      (p) => Math.abs(p.coord[0] - s.coord[0]) < 1e-5 && Math.abs(p.coord[1] - s.coord[1]) < 1e-5
    );
    if (existing) {
      removePlace(existing.id);
      toast.info('Removed', `${s.name} is no longer saved.`);
    } else {
      savePlace({ name: s.name, address: '', coord: s.coord });
      toast.success('Saved', `${s.name} is in your saved places.`);
    }
  };

  // Picking a saved place: drop it on the map, fly to it, and show the route.
  const pickSaved = useCallback(
    (place: SavedPlace) => {
      setSavedOpen(false);
      setCandidate(null);
      addStop(place.coord, place.name);
      focus(place.coord, 15);
      // Build the route right away, so tapping a place shows directions.
      setTimeout(async () => {
        const pendingNow = useTripStore.getState().stops.filter((s) => s.status === 'pending');
        if (!pendingNow.length) return;
        await previewRoute();
        const st = useTripStore.getState();
        if (st.route) toast.success('Route ready', `Directions to ${place.name} are shown.`);
        else toast.info('Stop added', st.error ?? `${place.name} was added to your stops.`);
      }, 350);
    },
    [addStop, focus, previewRoute, toast]
  );

  // A saved place id handed over from the Home strip adds itself on open.
  useEffect(() => {
    if (!savedParam) return;
    const place = savedPlaces.find((p) => p.id === savedParam);
    router.setParams({ saved: undefined });
    if (place) pickSaved(place);
  }, [savedParam, savedPlaces, pickSaved]);

  const vehicleNote = VEHICLES[vehicle].note;

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Delete all stops?',
      message: 'This removes every planned stop and route from the map.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (ok) clear();
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
        alternatives={alternatives}
        selectedAltId={selectedAltId}
        onAlternativePress={selectAlternative}
        onPress={onMapPress}
        onStopPress={onStopPress}
      />

      {/* Top: search only — everything else moved to the right control column */}
      <View style={[styles.top, { top: insets.top + 6 }]}>
        <SearchBar near={me} onSelect={onSelectPlace} />
      </View>

      {/* Right column: map style, saved places, vehicle type, locate me */}
      <View style={[styles.side, { top: insets.top + 62 }]}>
        <MapStyleSwitcher />
        <Pressable
          accessibilityLabel="Saved places"
          onPress={() => setSavedOpen(true)}
          style={({ pressed }) => [styles.sideBtn, pressed && styles.sideBtnPressed]}
        >
          <Ionicons name="bookmark-outline" size={20} color={colors.primaryStrong} />
          {savedPlaces.length > 0 && <View style={styles.sideDot} />}
        </Pressable>
        <Pressable
          accessibilityLabel="Vehicle type"
          onPress={() => setVehOpen(true)}
          style={({ pressed }) => [styles.sideBtn, pressed && styles.sideBtnPressed]}
        >
          <Ionicons name="car-sport-outline" size={20} color={colors.primaryStrong} />
          {vehicle !== 'car' && <View style={styles.sideDot} />}
        </Pressable>
        <LocateButton onPress={recenter} />
      </View>

      <OptionSheet
        visible={vehOpen}
        title="Vehicle type"
        value={vehicle}
        options={(Object.keys(VEHICLES) as VehicleKey[]).map((k) => ({
          key: k,
          label: VEHICLES[k].label,
          note: VEHICLES[k].note || undefined,
          icon: <VehicleIcon name={k} color={colors.primaryStrong} />,
        }))}
        onSelect={setVehicle}
        onClose={() => setVehOpen(false)}
      />

      <SavedPlacesSheet visible={savedOpen} onSelect={pickSaved} onClose={() => setSavedOpen(false)} />

      <OptionSheet
        visible={labelOpen}
        title="Save place as"
        value=""
        options={[
          { key: 'home', label: 'Home', icon: <Ionicons name="home-outline" size={17} color={colors.primaryStrong} /> },
          { key: 'work', label: 'Work', icon: <Ionicons name="briefcase-outline" size={17} color={colors.primaryStrong} /> },
          { key: 'place', label: candidate?.name ?? 'This place', icon: <Ionicons name="location-outline" size={17} color={colors.primaryStrong} /> },
        ]}
        onSelect={saveWithLabel}
        onClose={() => setLabelOpen(false)}
      />

      <MotiView
        from={{ opacity: 0, translateY: 40, scale: 0.98 }}
        animate={{ opacity: 1, translateY: 0, scale: 1 }}
        transition={{ type: 'timing', duration: 220 }}
        style={[styles.sheet, { bottom: insets.bottom + 12, maxHeight: expanded ? '78%' : 340 }]}
      >
        {candidate ? (
          <>
            <Text style={styles.title}>{candidate.name}</Text>
            {!!candidate.address && <Text style={styles.hint}>{candidate.address}</Text>}              <AnimatedButton label="Add to route" onPress={confirmCandidate} style={{ marginTop: 14 }} />
            <View style={styles.row}>
              <AnimatedButton
                label={candidateSaved ? 'Saved' : 'Save'}
                variant="ghost"
                onPress={saveCandidate}
                icon={
                  <Ionicons
                    name={candidateSaved ? 'bookmark' : 'bookmark-outline'}
                    size={16}
                    color={candidateSaved ? colors.accent : colors.text}
                  />
                }
                small
                style={candidateSaved ? styles.savedBtn : { flex: 1 }}
              />
              <AnimatedButton
                label="Cancel"
                variant="ghost"
                onPress={() => setCandidate(null)}
                small
                style={{ flex: 1 }}
              />
            </View>
          </>
        ) : (
          <>
            {/* Grabber: tap to expand or collapse the sheet */}
            <Pressable onPress={() => setExpanded((e) => !e)} style={styles.grabber} hitSlop={10}>
              <View style={styles.handle} />
              <View style={styles.grabRow}>
                <Text style={styles.grabHint}>{expanded ? 'Collapse' : 'Expand'}</Text>
                <Ionicons name={expanded ? 'chevron-down' : 'chevron-up'} size={15} color={colors.muted} />
              </View>
            </Pressable>

            {pending.length === 0 ? (
              // Compact empty state — no wall of buttons before there are stops.
              <View style={styles.empty}>
                <Ionicons name="map-outline" size={22} color={colors.muted} />
                <Text style={styles.emptyText}>Search a place or tap the map to add your first stop.</Text>
              </View>
            ) : (
              <>
                {/* Head: count + clear, always visible */}
                <View style={styles.sheetHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>
                      {pending.length} stop{pending.length === 1 ? '' : 's'} planned
                    </Text>
                    <Text style={styles.hint}>
                      {me ? 'Route starts from your location' : 'Turn on location to start from you'}
                    </Text>
                  </View>
                  <Pressable
                    onPress={clearAll}
                    hitSlop={8}
                    style={styles.headIcon}
                    accessibilityLabel="Clear all stops"
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
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
                  {pending.map((s, i) => {
                    const stopSaved = coordSaved(s.coord);
                    return (
                      <View key={s.id} style={styles.listRow}>
                        <Text style={[styles.arrow, { color: moves[s.id] === '▲' ? colors.up : colors.down }]}>
                          {moves[s.id] ?? ''}
                        </Text>
                        <Text style={styles.item} numberOfLines={1}>
                          {i + 1}. {s.name}
                        </Text>
                        <Pressable
                          onPress={() => toggleStopSave(s)}
                          hitSlop={8}
                          accessibilityLabel={stopSaved ? `Remove ${s.name} from saved places` : `Save ${s.name}`}
                        >
                          <Ionicons
                            name={stopSaved ? 'bookmark' : 'bookmark-outline'}
                            size={16}
                            color={stopSaved ? colors.accent : colors.muted}
                          />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
                </ScrollView>

                {/* Fixed compact footer — always reachable without scrolling */}
                <View style={styles.footer}>
                  <AnimatedButton
                    label={optimizing ? 'Optimizing…' : 'Optimize'}
                    variant="ghost"
                    onPress={optimize}
                    disabled={pending.length < 2 || optimizing}
                    icon={<Ionicons name="swap-horizontal" size={15} color={colors.text} />}
                    small
                    style={{ flex: 1 }}
                  />
                  <AnimatedButton
                    label={loading ? 'Finding…' : 'Routes'}
                    variant="ghost"
                    onPress={() => previewRoute()}
                    disabled={!pending.length || loading}
                    icon={<Ionicons name="git-branch-outline" size={15} color={colors.text} />}
                    small
                    style={{ flex: 1 }}
                  />
                  <AnimatedButton
                    label="Start"
                    onPress={() => router.push('/navigate')}
                    disabled={!pending.length}
                    icon={<Ionicons name="navigate-outline" size={15} color={colors.onPrimary} />}
                    small
                    style={{ flex: 1 }}
                  />
                </View>
              </>
            )}
          </>
        )}
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', left: 12, right: 12 },
  side: { position: 'absolute', right: 12, gap: 10, alignItems: 'center' },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.float,
  },
  sideBtnPressed: { backgroundColor: colors.surfaceAlt },
  sideDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  grabber: { alignItems: 'center', paddingBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  grabRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  grabHint: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 18 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: fonts.extrabold },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 8 },
  headIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { flexDirection: 'row', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border },
  hint: { color: colors.muted, marginTop: 6 },
  note: { color: colors.accent, marginTop: 6, fontSize: 12 },
  good: { color: colors.success, marginTop: 8, fontWeight: '600' },
  error: { color: colors.danger, marginTop: 6 },
  cardScroll: { flexGrow: 0, marginTop: 12 },
  cardRow: { gap: 8 },
  card: {
    padding: 12,
    minWidth: 150,
    borderRadius: radius.md,
    ...cardStyle,
  },
  cardOn: { borderColor: colors.primaryStrong },
  cardTitle: { color: colors.text, fontWeight: '700' },
  cardMeta: { color: colors.accent, marginTop: 4, fontWeight: '600' },
  list: { marginTop: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  savedBtn: { flex: 1, borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  arrow: { width: 16, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  item: { color: colors.text, flex: 1 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
