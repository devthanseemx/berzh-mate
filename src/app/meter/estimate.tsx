import { Ionicons } from '@expo/vector-icons';
import Mapbox from '@rnmapbox/maps';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { LocateButton } from '../../components/LocateButton';
import { MapControlGroup } from '../../components/MapControlGroup';
import { MapStyleSwitcher } from '../../components/MapStyleSwitcher';
import { OptionSheet } from '../../components/OptionSheet';
import { SearchBar } from '../../components/SearchBar';
import { useToast } from '../../components/Toast';
import { DEFAULT_CENTER, TripMap } from '../../components/TripMap';
import { VehicleIcon } from '../../components/vehicleIcons';
import {
  fetchAlternatives,
  reverseGeocode,
  VEHICLES,
  type VehicleKey,
} from '../../services/geoapify';
import { requestNavigationPermissions } from '../../services/location';
import { startMeterTracking, stopMeterTracking } from '../../services/meterLocation';
import { saveFareTrip } from '../../services/fares';
import { listRates, type Rate } from '../../services/rates';
import { getQuickLocation } from '../../services/whereAmI';
import { useMapPrefs } from '../../store/mapPrefs';
import { useMeter } from '../../store/meter';
import { useSettings } from '../../store/settings';
import { colors, radius, shadow } from '../../theme/colors';
import type { LngLat, RouteInfo, RouteOptionItem, Stop } from '../../types';
import { fareFor, money } from '../../utils/fare';
import { formatDistance, formatDuration } from '../../utils/format';

type Place = { name: string; address: string; coord: LngLat };
type Endpoint = 'start' | 'destination';

function clock(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours
    ? `${hours}:${pad(minutes)}:${pad(remainder)}`
    : `${pad(minutes)}:${pad(remainder)}`;
}

export default function Estimate() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const requestId = useRef(0);
  const insets = useSafeAreaInsets();
  const styleKey = useMapPrefs((s) => s.styleKey);
  const activeRateId = useMeter((s) => s.activeRateId);
  const run = useMeter((s) => s.run);
  const stopTrip = useMeter((s) => s.stopTrip);
  const saveHistory = useSettings((s) => s.saveHistory);
  const toast = useToast();
  const focusCoordinate = useCallback(
    (coordinate: LngLat, zoomLevel = 14) => {
      cameraRef.current?.setCamera({
        centerCoordinate: coordinate,
        zoomLevel,
        padding: {
          paddingTop: insets.top + 116,
          paddingRight: 68,
          paddingBottom: 250,
          paddingLeft: 12,
        },
        animationDuration: 600,
      });
    },
    [insets.top]
  );

  const [rates, setRates] = useState<Rate[]>([]);
  const [me, setMe] = useState<LngLat | null>(null);
  const [startPlace, setStartPlace] = useState<Place | null>(null);
  const [dest, setDest] = useState<Place | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteOptionItem[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleKey>('car');
  const [endpoint, setEndpoint] = useState<Endpoint>('destination');
  const [searchOpen, setSearchOpen] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveMeter, setLiveMeter] = useState(false);
  const [meterBusy, setMeterBusy] = useState(false);
  const [meterError, setMeterError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [topPanelHeight, setTopPanelHeight] = useState(0);
  const [sheetExpanded, setSheetExpanded] = useState(true);

  const rate = rates.find((r) => r.id === activeRateId) ?? null;
  const start = startPlace?.coord ?? me;
  const elapsedS = run.startedAt ? Math.max(0, ((run.status === 'done' ? run.endedAt ?? now : now) - run.startedAt) / 1000) : 0;
  const runningFare = run.rate ? fareFor(run.distanceM, run.rate.pricePerKm, run.rate.baseFare) : 0;

  useFocusEffect(
    useCallback(
      () => () => {
        Keyboard.dismiss();
      },
      []
    )
  );

  useEffect(() => {
    listRates().then(setRates).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : 'Could not load meter rates.');
    });
    getQuickLocation().then((position) => {
      if (!position) return;
      setMe(position);
      focusCoordinate(position);
    });
  }, [focusCoordinate]);

  useEffect(
    () => () => {
      requestId.current += 1;
    },
    []
  );

  const stops: Stop[] = useMemo(
    () => (dest ? [{ id: 'dest', name: dest.name, coord: dest.coord, status: 'pending' }] : []),
    [dest]
  );

  useEffect(() => {
    if (!dest || !start) {
      requestId.current += 1;
      setRoute(null);
      setRouteOptions([]);
      setSelectedRouteId(null);
      setBusy(false);
      return;
    }
    const id = ++requestId.current;
    setRoute(null);
    setRouteOptions([]);
    setSelectedRouteId(null);
    setError(null);
    setBusy(true);
    const asOption = ({ id: optionId, label, raw }: Awaited<ReturnType<typeof fetchAlternatives>>[number]): RouteOptionItem => ({
      legs: raw.legs ?? [raw.geometry],
      steps: raw.steps ?? [],
      legDistanceM: raw.legDistanceM,
      legDurationS: raw.legDurationS,
      distanceM: raw.distanceM,
      durationS: raw.durationS,
      id: optionId,
      label,
    });
    fetchAlternatives([start, dest.coord], vehicle, (first) => {
      if (requestId.current !== id) return;
      const option = asOption(first);
      setRouteOptions([option]);
      setRoute(option);
      setSelectedRouteId(option.id);
    })
      .then((found) => {
        if (requestId.current !== id) return;
        const options: RouteOptionItem[] = found.map(asOption);
        setRouteOptions(options);
        setRoute(options[0] ?? null);
        setSelectedRouteId(options[0]?.id ?? null);
      })
      .catch((e: unknown) => {
        if (requestId.current === id) setError(e instanceof Error ? e.message : 'Could not calculate the route.');
      })
      .finally(() => {
        if (requestId.current === id) setBusy(false);
      });
    return () => {
      if (requestId.current === id) requestId.current += 1;
    };
  }, [dest, start, vehicle]);

  useEffect(() => {
    if (!route || liveMeter) return;
    const coordinates = route.legs.flat();
    if (coordinates.length < 2) return;
    const bounds = coordinates.reduce(
      (value, point) => ({
        north: Math.max(value.north, point[1]),
        east: Math.max(value.east, point[0]),
        south: Math.min(value.south, point[1]),
        west: Math.min(value.west, point[0]),
      }),
      { north: -Infinity, east: -Infinity, south: Infinity, west: Infinity }
    );
    cameraRef.current?.fitBounds(
      [bounds.east, bounds.north],
      [bounds.west, bounds.south],
      [insets.top + 155, 68, insets.bottom + 285, 36],
      700
    );
  }, [insets.bottom, insets.top, liveMeter, route]);

  useEffect(() => {
    if (liveMeter && run.status === 'running' && run.last) {
      cameraRef.current?.setCamera({
        centerCoordinate: run.last,
        zoomLevel: 16,
        padding: { paddingTop: insets.top + 60, paddingRight: 0, paddingBottom: 250, paddingLeft: 0 },
        animationDuration: 700,
      });
    }
  }, [insets.top, liveMeter, run.last, run.status]);

  useEffect(() => {
    if (!liveMeter || run.status !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [liveMeter, run.status]);

  const selectRoute = useCallback((option: RouteOptionItem) => {
    setRoute(option);
    setSelectedRouteId(option.id);
  }, []);

  const locateMe = useCallback(async () => {
    setLocating(true);
    try {
      const position = await getQuickLocation();
      if (!position) {
        toast.error('Location unavailable', 'Allow location access and turn on GPS to find your current location.');
        return;
      }
      setMe(position);
      focusCoordinate(position, 15);
    } finally {
      setLocating(false);
    }
  }, [focusCoordinate, toast]);

  const chooseMapPoint = useCallback(
    (coord: LngLat) => {
      const pinned = { name: 'Pinned location', address: '', coord };
      if (endpoint === 'start') setStartPlace(pinned);
      else {
        setDest(pinned);
        setSheetExpanded(true);
      }
      setSearchOpen(false);
      focusCoordinate(coord);
      void reverseGeocode(coord)
        .then((placeName) => {
          if (!placeName) return;
          const updateName = (place: Place | null) =>
            place && place.coord[0] === coord[0] && place.coord[1] === coord[1]
              ? { ...place, name: placeName }
              : place;
          setStartPlace((place) => updateName(place));
          setDest((place) => updateName(place));
        })
        .catch((error: unknown) => {
          toast.error(
            'Could not identify this place',
            error instanceof Error ? error.message : 'The selected map pin will still be used.'
          );
        });
    },
    [endpoint, focusCoordinate, toast]
  );

  const onMapPress = useCallback(
    (event: any) => {
      if (busy) return;
      void chooseMapPoint(event.geometry.coordinates as LngLat);
    },
    [busy, chooseMapPoint]
  );

  const selectSearchResult = useCallback(
    (place: { name: string; address: string; coord: LngLat | null }) => {
      if (!place.coord) return;
      const selected = { name: place.name, address: place.address, coord: place.coord };
      if (endpoint === 'start') setStartPlace(selected);
      else {
        setDest(selected);
        setSheetExpanded(true);
      }
      setSearchOpen(false);
      focusCoordinate(place.coord);
    },
    [endpoint, focusCoordinate]
  );

  const clear = () => {
    requestId.current += 1;
    setDest(null);
    setRoute(null);
    setRouteOptions([]);
    setSelectedRouteId(null);
    setError(null);
    setBusy(false);
    setSheetExpanded(true);
  };

  const startMeter = async () => {
    if (!rate) {
      router.push('/meter/rates');
      return;
    }
    const ok = await requestNavigationPermissions();
    if (!ok) {
      toast.error('Location needed', 'Allow location access to measure the trip.');
      return;
    }
    useMeter.getState().startTrip({
      name: rate.name,
      pricePerKm: rate.price_per_km,
      baseFare: rate.base_fare,
    });
    try {
      await startMeterTracking();
      setLiveMeter(true);
      setNow(Date.now());
      toast.success('Trip started', 'The meter is now running.');
    } catch (e: unknown) {
      useMeter.getState().reset();
      toast.error('Meter could not start', e instanceof Error ? e.message : 'Could not start location tracking.');
    }
  };

  const endMeter = async () => {
    setMeterBusy(true);
    setMeterError(null);
    try {
      await stopMeterTracking();
      const finished = stopTrip();
      let saved = false;
      if (finished?.rate && finished.startedAt && finished.endedAt && saveHistory) {
        await saveFareTrip({
          rate: finished.rate,
          distanceM: finished.distanceM,
          durationS: (finished.endedAt - finished.startedAt) / 1000,
          fare: fareFor(finished.distanceM, finished.rate.pricePerKm, finished.rate.baseFare),
          startedAt: finished.startedAt,
          endedAt: finished.endedAt,
          path: finished.path,
        });
        saved = true;
      }
      setNow(Date.now());
      toast.success('Trip completed', saved ? 'Saved to your trip history.' : 'History saving is off in Settings.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not finish and save the trip.';
      setMeterError(message);
      toast.error('Trip not saved', message);
    } finally {
      setMeterBusy(false);
    }
  };

  const fastestRouteId = routeOptions.reduce<RouteOptionItem | null>(
    (best, option) => (!best || option.durationS < best.durationS ? option : best),
    null
  )?.id;
  const shortestRouteId = routeOptions.reduce<RouteOptionItem | null>(
    (best, option) => (!best || option.distanceM < best.distanceM ? option : best),
    null
  )?.id;
  const finishedFare = run.rate
    ? fareFor(run.distanceM, run.rate.pricePerKm, run.rate.baseFare)
    : runningFare;

  if (liveMeter) {
    return (
      <View style={styles.root}>
        <TripMap
          cameraRef={cameraRef}
          styleKey={styleKey}
          surfaceView={false}
          initialCenter={run.last ?? me ?? DEFAULT_CENTER}
          stops={stops}
          route={route}
          routeMode="plan"
          me={run.last ?? me}
          candidate={null}
          showNames
        />
        <MapControlGroup style={{ top: insets.top + 6 }}>
          <MapStyleSwitcher />
          <LocateButton onPress={locateMe} busy={locating} />
        </MapControlGroup>
        <View style={[styles.liveHeader, { top: insets.top + 12 }]}>
          <Text style={styles.liveHeaderLabel}>
            {run.status === 'running' ? 'METER RUNNING' : 'TRIP COMPLETE'}
          </Text>
          <Text style={styles.liveHeaderDestination} numberOfLines={1}>{dest?.name ?? 'Meter trip'}</Text>
        </View>
        <View style={[styles.liveSheet, { bottom: insets.bottom + 12 }]}>
          <View style={styles.liveFareRow}>
            <View>
              <Text style={styles.liveFareLabel}>{run.status === 'running' ? 'CURRENT FARE' : 'TOTAL FARE'}</Text>
              <Text style={styles.liveFare}>{money(finishedFare)}</Text>
            </View>
            {run.status === 'running' && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveIndicatorText}>LIVE</Text>
              </View>
            )}
          </View>
          <View style={styles.liveStats}>
            <View style={styles.liveStat}>
              <Text style={styles.liveStatValue}>{formatDistance(run.distanceM)}</Text>
              <Text style={styles.liveStatLabel}>Distance</Text>
            </View>
            {!!meterError && <Text style={styles.error}>{meterError}</Text>}
            <View style={styles.liveStatDivider} />
            <View style={styles.liveStat}>
              <Text style={styles.liveStatValue}>{clock(elapsedS)}</Text>
              <Text style={styles.liveStatLabel}>Duration</Text>
            </View>
            <View style={styles.liveStatDivider} />
            <View style={styles.liveStat}>
              <Text style={styles.liveStatValue}>{run.rate ? money(run.rate.pricePerKm) : '—'}</Text>
              <Text style={styles.liveStatLabel}>Per km</Text>
            </View>
          </View>
          {run.status === 'running' ? (
            <AnimatedButton
              label={meterBusy ? 'Ending…' : 'End trip'}
              variant="danger"
              disabled={meterBusy}
              onPress={endMeter}
              style={{ marginTop: 14 }}
            />
          ) : (
            <AnimatedButton
              label="Done"
              onPress={() => router.replace('/meter')}
              style={{ marginTop: 14 }}
            />
          )}
        </View>
      </View>
    );
  }

  const fare = route && rate ? fareFor(route.distanceM, rate.price_per_km, rate.base_fare) : null;
  const selectedStartName = startPlace?.name ?? 'My location';

  return (
    <View style={styles.root}>
      <TripMap
        cameraRef={cameraRef}
        styleKey={styleKey}
        surfaceView={false}
        initialCenter={me ?? DEFAULT_CENTER}
        stops={stops}
        route={route}
        routeMode="plan"
        me={me}
        candidate={startPlace?.coord ?? null}
        showNames
        onPress={onMapPress}
      />

      <View
        style={[styles.top, { top: insets.top + 6 }]}
        onLayout={(event) => {
          const height = Math.ceil(event.nativeEvent.layout.height);
          setTopPanelHeight((previous) => (previous === height ? previous : height));
        }}
      >
        <View style={styles.endpointStack}>
          {searchOpen && endpoint === 'start' ? (
            <View style={styles.endpointSearch}>
              <Text style={styles.endpointLabel}>FROM</Text>
              <SearchBar near={me} onSelect={selectSearchResult} placeholder="Search starting place" />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose meter trip start"
              onPress={() => {
                setEndpoint('start');
                setSearchOpen(true);
              }}
              style={styles.endpointField}
            >
              <Ionicons name="radio-button-on" size={17} color={colors.accent} />
              <View style={styles.endpointCopy}>
                <Text style={styles.endpointLabel}>FROM</Text>
                <Text style={styles.endpointValue} numberOfLines={1}>{selectedStartName}</Text>
              </View>
              <Ionicons name="search-outline" size={16} color={colors.muted} />
            </Pressable>
          )}
          <View style={styles.endpointDivider}>
            <View style={styles.dividerLine} />
            <Ionicons name="arrow-down" size={15} color={colors.muted} />
            <View style={styles.dividerLine} />
          </View>
          {searchOpen && endpoint === 'destination' ? (
            <View style={styles.endpointSearch}>
              <Text style={styles.endpointLabel}>TO</Text>
              <SearchBar near={me} onSelect={selectSearchResult} placeholder="Search destination" />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose meter trip destination"
              onPress={() => {
                setEndpoint('destination');
                setSearchOpen(true);
              }}
              style={styles.endpointField}
            >
              <Ionicons name="location" size={17} color={colors.primaryStrong} />
              <View style={styles.endpointCopy}>
                <Text style={styles.endpointLabel}>TO</Text>
                <Text style={styles.endpointValue} numberOfLines={1}>{dest?.name ?? 'Choose destination'}</Text>
              </View>
              <Ionicons name="search-outline" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
        {startPlace && (
          <Pressable
            onPress={() => {
              setStartPlace(null);
              setEndpoint('destination');
              setSearchOpen(false);
            }}
            style={styles.useMyLocation}
          >
            <Ionicons name="locate-outline" size={13} color={colors.accent} />
            <Text style={styles.useMyLocationText}>Use my location as start</Text>
          </Pressable>
        )}
      </View>

      {!searchOpen && topPanelHeight > 0 && <MapControlGroup style={{ top: insets.top + 6 + topPanelHeight + 6 }}>
        <MapStyleSwitcher />
        <LocateButton onPress={locateMe} busy={locating} />
      </MapControlGroup>}
      <OptionSheet
        visible={vehicleOpen}
        title="Vehicle type"
        value={vehicle}
        options={(Object.keys(VEHICLES) as VehicleKey[]).map((key) => ({
          key,
          label: VEHICLES[key].label,
          note: VEHICLES[key].note,
          icon: <VehicleIcon name={key} color={colors.primaryStrong} />,
        }))}
        onSelect={setVehicle}
        onClose={() => setVehicleOpen(false)}
      />

      {(dest || busy || error) && !searchOpen && (
        <ScrollView
          style={[styles.sheet, { bottom: Math.max(insets.bottom, 12) + 12, maxHeight: sheetExpanded ? '56%' : undefined }]}
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeading}>
              <Text style={styles.title} numberOfLines={1}>{dest?.name ?? 'Route estimate'}</Text>
              {route && <Text style={styles.accent}>{formatDistance(route.distanceM)} · {formatDuration(route.durationS)}</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sheetExpanded ? 'Collapse estimate details' : 'Expand estimate details'}
              accessibilityState={{ expanded: sheetExpanded }}
              onPress={() => setSheetExpanded((expanded) => !expanded)}
              style={styles.sheetToggle}
            >
              <Ionicons name={sheetExpanded ? 'chevron-down' : 'chevron-up'} size={20} color={colors.primaryStrong} />
            </Pressable>
          </View>
          {sheetExpanded && (
            <>
              {busy && !route && <Text style={styles.hint}>Finding the route…</Text>}
              {!!error && <Text style={styles.error}>{error}</Text>}
              {!!dest?.address && <Text style={styles.hint} numberOfLines={1}>{dest.address}</Text>}
              {startPlace && <Text style={styles.hint}>From {startPlace.name}</Text>}
              {routeOptions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.routeOptions}
                  contentContainerStyle={styles.routeOptionRow}
                >
                  {routeOptions.map((option) => {
                    const selected = option.id === selectedRouteId;
                    const isFastest = option.id === fastestRouteId;
                    const isShortest = option.id === shortestRouteId;
                    const label = isFastest && isShortest
                      ? 'Fastest · Shortest'
                      : isFastest
                        ? 'Fastest'
                        : isShortest
                          ? 'Shortest'
                          : option.label;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => selectRoute(option)}
                        style={[styles.routeOption, selected && styles.routeOptionSelected]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text style={styles.routeOptionLabel}>{label}</Text>
                        <Text style={styles.routeOptionDistance}>{formatDistance(option.distanceM)}</Text>
                        <Text style={styles.routeOptionDuration}>{formatDuration(option.durationS)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {route && rate && fare !== null && (
                <View style={styles.fareBox}>
                  <Text style={styles.fareLabel}>ESTIMATED FARE · {rate.name.toUpperCase()}</Text>
                  <Text style={styles.fare}>{money(fare)}</Text>
                  <Text style={styles.breakdown}>
                    {rate.base_fare > 0 ? `${money(rate.base_fare)} base + ` : ''}
                    {(route.distanceM / 1000).toFixed(2)} km × {money(rate.price_per_km)}
                  </Text>
                </View>
              )}
              {route && !rate && <Text style={styles.hint}>No rate selected. Choose one to see the fare.</Text>}
              <View style={styles.startRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Vehicle type: ${VEHICLES[vehicle].label}`}
                  onPress={() => setVehicleOpen(true)}
                  style={styles.vehicleButton}
                >
                  <VehicleIcon name={vehicle} size={20} color={colors.primaryStrong} />
                </Pressable>
                <AnimatedButton
                  label={rate ? 'Start meter' : 'Choose a rate'}
                  onPress={startMeter}
                  disabled={!route || busy}
                  style={{ flex: 1 }}
                />
              </View>
              <AnimatedButton label="Clear" variant="ghost" onPress={clear} style={{ marginTop: 10 }} />
              <Text style={styles.note}>
                The estimate uses the planned road distance. The meter measures the distance you actually drive.
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', left: 12, right: 12 },
  endpointStack: {
    gap: 4,
    marginRight: 4,
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  endpointField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  endpointSearch: { padding: 8, borderRadius: 10, backgroundColor: colors.surfaceAlt, marginVertical: 2 },
  endpointDivider: { height: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  dividerLine: { height: 1, flex: 1, backgroundColor: colors.border },
  endpointCopy: { flex: 1, minWidth: 0 },
  endpointLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  endpointValue: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 1 },
  useMyLocation: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginBottom: 5, paddingHorizontal: 4 },
  useMyLocationText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  sheetHeading: { flex: 1, minWidth: 0, gap: 3 },
  sheetToggle: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  vehicleButton: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border },
  routeOptions: { marginTop: 12, marginHorizontal: -18 },
  routeOptionRow: { gap: 8, paddingHorizontal: 18 },
  routeOption: {
    minWidth: 134,
    padding: 11,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  routeOptionSelected: { borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  routeOptionLabel: { color: colors.text, fontSize: 12, fontWeight: '800' },
  routeOptionDistance: { color: colors.accent, fontSize: 13, fontWeight: '700', marginTop: 5 },
  routeOptionDuration: { color: colors.muted, fontSize: 11, marginTop: 2 },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    maxHeight: '48%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  sheetContent: { padding: 18 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  accent: { color: colors.accent, fontWeight: '700', marginTop: 4 },
  fareBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primaryStrong,
  },
  fareLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  fare: { color: colors.accent, fontSize: 30, fontWeight: '800', marginTop: 4 },
  breakdown: { color: colors.muted, fontSize: 12, marginTop: 4 },
  hint: { color: colors.muted, marginTop: 6 },
  note: { color: colors.muted, fontSize: 11, marginTop: 10 },
  error: { color: colors.danger, marginTop: 6 },
  liveHeader: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  liveHeaderLabel: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  liveHeaderDestination: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  liveSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  liveFareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  liveFareLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  liveFare: { color: colors.accent, fontSize: 34, fontWeight: '800', marginTop: 2 },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveIndicatorText: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  liveStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  liveStat: { flex: 1, alignItems: 'center', gap: 3 },
  liveStatDivider: { width: 1, height: 32, backgroundColor: colors.border },
  liveStatValue: { color: colors.text, fontSize: 14, fontWeight: '800' },
  liveStatLabel: { color: colors.muted, fontSize: 11 },
});
