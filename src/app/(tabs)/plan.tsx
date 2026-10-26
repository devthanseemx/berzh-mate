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
import { MapControlGroup } from '../../components/MapControlGroup';
import { MapStyleSwitcher } from '../../components/MapStyleSwitcher';
import { OptionSheet } from '../../components/OptionSheet';
import { SearchBar } from '../../components/SearchBar';
import { SavedPlacesSheet } from '../../components/SavedPlacesSheet';
import { SavePlaceSheet } from '../../components/SavePlaceSheet';
import { DEFAULT_CENTER, TripMap } from '../../components/TripMap';
import { useToast } from '../../components/Toast';
import { VehicleIcon } from '../../components/vehicleIcons';
import { resolveGoogleMapsLocation } from '../../services/googleMapsLinks';
import {
  fetchAlternatives,
  reverseGeocode,
  VEHICLES,
  type Pref,
  type VehicleKey,
} from '../../services/geoapify';
import type { PlaceResult } from '../../services/mapbox';
import { getMyLocation } from '../../services/whereAmI';
import { useMapPrefs } from '../../store/mapPrefs';
import { useSavedPlaces, type SavedPlace } from '../../store/savedPlaces';
import { useTripStore, type OptimizeResult } from '../../store/tripStore';
import { cardStyle, colors, radius, shadow } from '../../theme/colors';
import { fonts } from '../../theme/font';
import type { LngLat, RouteInfo, RouteOptionItem, Stop } from '../../types';
import { formatDistance, formatDuration } from '../../utils/format';

type SearchTarget = 'start' | 'destination';
type PlanningMode = 'distance' | 'multi';
type SaveTarget = { coord: LngLat; name: string; address?: string };

function samePlace(a: LngLat, b: LngLat): boolean {
  return Math.abs(a[0] - b[0]) < 1e-5 && Math.abs(a[1] - b[1]) < 1e-5;
}

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
  const distanceRequest = useRef(0);
  const startedDistanceNavigation = useRef(false);
  const distanceNavigationActive = useRef(false);
  const addTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();
  const toast = useToast();
  // Deep-linked saved place from the Home strip: /plan?saved=<id>
  const { saved: savedParam, mapsUrl } = useLocalSearchParams<{ saved?: string; mapsUrl?: string | string[] }>();

  const [me, setMe] = useState<LngLat | null>(null);
  const [candidate, setCandidate] = useState<PlaceResult | null>(null);
  const [planningMode, setPlanningMode] = useState<PlanningMode>('multi');
  const [startPlace, setStartPlace] = useState<PlaceResult | null>(null);
  const [searchTarget, setSearchTarget] = useState<SearchTarget>('destination');
  const [searchOpen, setSearchOpen] = useState(false);
  const [estimateDestination, setEstimateDestination] = useState<PlaceResult | null>(null);
  const [distanceRoute, setDistanceRoute] = useState<RouteInfo | null>(null);
  const [distanceAlternatives, setDistanceAlternatives] = useState<RouteOptionItem[]>([]);
  const [distanceSelectedId, setDistanceSelectedId] = useState<string | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<SaveTarget | null>(null);
  const [vehOpen, setVehOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [topPanelHeight, setTopPanelHeight] = useState(0);
  const handledMapsUrl = useRef<string | null>(null);

  const styleKey = useMapPrefs((s) => s.styleKey);
  const stops = useTripStore((s) => s.stops);
  const route = useTripStore((s) => s.route);
  const alternatives = useTripStore((s) => s.alternatives);
  const selectedAltId = useTripStore((s) => s.selectedAltId);
  const vehicle = useTripStore((s) => s.vehicle);
  const navigating = useTripStore((s) => s.navigating);
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
  const savedCategories = useMemo(
    () => [...new Set(savedPlaces.map((place) => place.category).filter((category): category is string => !!category))],
    [savedPlaces]
  );

  // Reactive check — re-renders the bookmark state the moment a place is saved.
  const coordSaved = (c: LngLat | null) =>
    !!c && savedPlaces.some((p) => Math.abs(p.coord[0] - c[0]) < 1e-5 && Math.abs(p.coord[1] - c[1]) < 1e-5);
  const candidateSaved = coordSaved(candidate?.coord ?? null);

  const pending = useMemo(() => stops.filter((s) => s.status === 'pending'), [stops]);
  const distanceStops = useMemo<Stop[]>(() => {
    const selected: Stop[] = [];
    if (startPlace?.coord) {
      selected.push({ id: 'distance-start', name: startPlace.name, coord: startPlace.coord, status: 'pending' });
    }
    if (estimateDestination?.coord) {
      selected.push({
        id: 'distance-destination',
        name: estimateDestination.name,
        coord: estimateDestination.coord,
        status: 'pending',
      });
    }
    return selected;
  }, [estimateDestination, startPlace]);

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

  const importGoogleMapsLink = useCallback(async (rawUrl: string) => {
    try {
      const sharedLocation = await resolveGoogleMapsLocation(rawUrl);
      setPlanningMode('distance');
      setStartPlace(null);
      setSearchTarget('destination');
      setSearchOpen(false);
      setEstimateDestination({
        id: `google-maps-${sharedLocation.coord[0]}-${sharedLocation.coord[1]}`,
        name: sharedLocation.name,
        address: 'Shared from Google Maps',
        coord: sharedLocation.coord,
      });
      focus(sharedLocation.coord);
      toast.success('Location opened', `${sharedLocation.name} is ready as your destination.`);
    } catch (error: unknown) {
      toast.error(
        'Could not open location',
        error instanceof Error ? error.message : 'Check the Google Maps link and try again.'
      );
    }
  }, [focus, toast]);

  useEffect(() => {
    const sharedUrl = Array.isArray(mapsUrl) ? mapsUrl[0] : mapsUrl;
    if (!sharedUrl) {
      handledMapsUrl.current = null;
      return;
    }
    if (handledMapsUrl.current === sharedUrl) return;
    handledMapsUrl.current = sharedUrl;
    router.setParams({ mapsUrl: undefined });
    void importGoogleMapsLink(sharedUrl);
  }, [importGoogleMapsLink, mapsUrl]);

  const recenter = useCallback(async () => {
    const pos = await getMyLocation();
    if (!pos) return;
    setMe(pos);
    focus(pos, 16);
  }, [focus]);

  useEffect(() => {
    if (planningMode !== 'distance') return;
    const origin = startPlace?.coord ?? me;
    const destination = estimateDestination?.coord;
    const requestId = ++distanceRequest.current;

    setDistanceRoute(null);
    setDistanceAlternatives([]);
    setDistanceSelectedId(null);
    setDistanceError(null);

    if (!origin || !destination) {
      setDistanceLoading(false);
      return;
    }
    if (samePlace(origin, destination)) {
      setDistanceLoading(false);
      setDistanceError('Choose two different places to see a route.');
      return;
    }

    setDistanceLoading(true);
    fetchAlternatives([origin, destination], vehicle)
      .then((found) => {
        if (distanceRequest.current !== requestId) return;
        const options: RouteOptionItem[] = found.map(({ id, label, raw }) => ({
          legs: raw.legs ?? [raw.geometry],
          steps: raw.steps ?? [],
          legDistanceM: raw.legDistanceM,
          legDurationS: raw.legDurationS,
          distanceM: raw.distanceM,
          durationS: raw.durationS,
          id,
          label,
        }));
        setDistanceAlternatives(options);
        setDistanceRoute(options[0]);
        setDistanceSelectedId(options[0]?.id ?? null);
      })
      .catch((e: unknown) => {
        if (distanceRequest.current === requestId) {
          setDistanceError(e instanceof Error ? e.message : 'Could not find a route.');
        }
      })
      .finally(() => {
        if (distanceRequest.current === requestId) setDistanceLoading(false);
      });

    return () => {
      if (distanceRequest.current === requestId) distanceRequest.current += 1;
    };
  }, [estimateDestination, me, planningMode, startPlace, vehicle]);

  const chooseDistanceRoute = useCallback((option: RouteOptionItem) => {
    setDistanceRoute(option);
    setDistanceSelectedId(option.id);
  }, []);

  useEffect(() => {
    if (planningMode !== 'distance' || !distanceRoute) return;
    const coordinates = distanceRoute.legs.flat();
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
      [insets.top + 175, 36, insets.bottom + 205, 36],
      700
    );
  }, [distanceRoute, insets.bottom, insets.top, planningMode]);

  const startDistanceNavigation = useCallback(() => {
    const destination = estimateDestination;
    const selectedRoute = distanceRoute;
    if (!destination?.coord || !selectedRoute || !distanceSelectedId) return;

    const trip = useTripStore.getState();
    trip.clear();
    trip.addStop(destination.coord, destination.name);
    useTripStore.setState({
      vehicle,
      route: selectedRoute,
      alternatives: [],
      selectedAltId: distanceSelectedId as Pref,
      error: null,
    });
    startedDistanceNavigation.current = true;
    router.push('/navigate');
  }, [distanceRoute, distanceSelectedId, estimateDestination, vehicle]);

  const clearDistanceRoute = useCallback(() => {
    distanceRequest.current += 1;
    setEstimateDestination(null);
    setDistanceRoute(null);
    setDistanceAlternatives([]);
    setDistanceSelectedId(null);
    setDistanceError(null);
    setDistanceLoading(false);
  }, []);

  useEffect(() => {
    if (startedDistanceNavigation.current && navigating) {
      startedDistanceNavigation.current = false;
      distanceNavigationActive.current = true;
      return;
    }
    if (distanceNavigationActive.current && !navigating) {
      distanceNavigationActive.current = false;
      clearDistanceRoute();
    }
  }, [clearDistanceRoute, navigating]);

  const selectVehicle = useCallback(
    (nextVehicle: VehicleKey) => {
      if (planningMode === 'distance') {
        useTripStore.setState({ vehicle: nextVehicle });
        return;
      }
      void setVehicle(nextVehicle);
    },
    [planningMode, setVehicle]
  );

  const saveCurrentLocation = useCallback(async () => {
    if (me) {
      setSaveTarget({ coord: me, name: 'Current location' });
      void getMyLocation().then((coord) => {
        if (!coord) return;
        setMe(coord);
        setSaveTarget((target) =>
          target?.name === 'Current location' && samePlace(target.coord, me)
            ? { ...target, coord }
            : target
        );
      }).catch(() => {
        toast.info('Using last known location', 'Your saved place will use the most recent location on the map.');
      });
      return;
    }
    const coord = await getMyLocation();
    if (!coord) {
      toast.error('Location unavailable', 'Allow location access and try again.');
      return;
    }
    setMe(coord);
    setSaveTarget({ coord, name: 'Current location' });
  }, [me, toast]);

  const selectDistanceEndpoint = useCallback(
    (place: PlaceResult, target: SearchTarget) => {
      if (!place.coord) {
        toast.info('Location unavailable', 'Choose a search result with a map location.');
        return;
      }
      distanceRequest.current += 1;
      setDistanceRoute(null);
      setDistanceError(null);
      if (target === 'start') {
        setStartPlace(place);
        setSearchTarget('destination');
      } else {
        setEstimateDestination(place);
      }
      setSearchOpen(false);
      if (place.coord) focus(place.coord, 15);
    },
    [focus, toast]
  );

  const selectDistanceMapPoint = useCallback(
    async (coord: LngLat) => {
      const target = searchTarget;
      const name = (await reverseGeocode(coord).catch(() => null)) ?? 'Pinned location';
      selectDistanceEndpoint(
        { id: `map-${Date.now()}`, name, address: '', coord },
        target
      );
    },
    [searchTarget, selectDistanceEndpoint]
  );

  const setMode = useCallback((mode: PlanningMode) => {
    if (mode === planningMode) return;
    setPlanningMode(mode);
    setSearchOpen(false);
    setCandidate(null);
    distanceRequest.current += 1;
    setSearchTarget('destination');
    setDistanceRoute(null);
    setDistanceAlternatives([]);
    setDistanceSelectedId(null);
    setDistanceError(null);
    setDistanceLoading(false);
    if (mode === 'distance') {
      setStartPlace(null);
      setEstimateDestination(null);
    }
  }, [planningMode]);

  const addPinned = useCallback(
    (coord: LngLat) => {
      const alreadyAdded = useTripStore.getState().stops.some((stop) => samePlace(stop.coord, coord));
      if (alreadyAdded) {
        toast.info('Already added', 'That place is already in your planned stops.');
        return;
      }
      distanceRequest.current += 1;
      const id = addStop(coord, 'Locating…');
      setEstimateDestination({ id, name: 'Pinned location', address: '', coord });
      reverseGeocode(coord)
        .then((name) => {
          const placeName = name ?? 'Pinned location';
          renameStop(id, placeName);
          setEstimateDestination({ id, name: placeName, address: '', coord });
        })
        .catch(() => renameStop(id, 'Pinned location'));
    },
    [addStop, renameStop, toast]
  );

  const onMapPress = useCallback(
    (e: any) => {
      if (Date.now() - tapGuard.current < 500) return;
      const coord = e.geometry.coordinates as LngLat;
      if (planningMode === 'distance') {
        void selectDistanceMapPoint(coord);
        return;
      }
      if (searchTarget === 'start') {
        const id = `map-${Date.now()}`;
        distanceRequest.current += 1;
        setStartPlace({ id, name: 'Pinned start', address: '', coord });
        setSearchTarget('destination');
        setSearchOpen(false);
        setCandidate(null);
        focus(coord);
        reverseGeocode(coord)
          .then((name) => {
            if (name) setStartPlace({ id, name, address: '', coord });
          })
          .catch(() => toast.info('Start selected', 'The place name could not be found.'));
        return;
      }
      setCandidate(null);
      if (addTimer.current) clearTimeout(addTimer.current);
      addTimer.current = setTimeout(() => addPinned(coord), 250);
    },
    [addPinned, focus, planningMode, searchTarget, selectDistanceMapPoint, toast]
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
      if (planningMode === 'distance') {
        selectDistanceEndpoint(place, searchTarget);
        return;
      }
      if (searchTarget === 'start') {
        setStartPlace(place);
        setSearchTarget('destination');
        setSearchOpen(false);
        if (place.coord) focus(place.coord);
        return;
      }
      const coord = place.coord;
      if (coord && useTripStore.getState().stops.some((stop) => samePlace(stop.coord, coord))) {
        setCandidate(null);
        toast.info('Already added', `${place.name} is already in your planned stops.`);
        return;
      }
      distanceRequest.current += 1;
      setCandidate(place);
      setEstimateDestination(place);
      if (coord) focus(coord);
    },
    [focus, planningMode, searchTarget, selectDistanceEndpoint, toast]
  );

  const confirmCandidate = () => {
    const coord = candidate?.coord;
    if (!candidate || !coord) return;
    if (useTripStore.getState().stops.some((stop) => samePlace(stop.coord, coord))) {
      setCandidate(null);
      toast.info('Already added', `${candidate.name} is already in your planned stops.`);
      return;
    }
    addStop(coord, candidate.name);
    setCandidate(null);
  };

  const cancelCandidate = () => {
    setCandidate(null);
    const firstStop = pending[0];
    setEstimateDestination(
      firstStop ? { id: firstStop.id, name: firstStop.name, address: '', coord: firstStop.coord } : null
    );
  };

  const saveCandidate = () => {
    if (!candidate?.coord) return;
    if (coordSaved(candidate.coord)) {
      toast.info('Already saved', 'This place is in your saved places.');
      return;
    }
    setSaveTarget({ coord: candidate.coord, name: candidate.name, address: candidate.address });
  };

  const savePlaceWithDetails = (name: string, category: string | null) => {
    if (!saveTarget) return;
    savePlace({ name, category, address: saveTarget.address, coord: saveTarget.coord });
    toast.success('Saved', `${name} is in your saved places.`);
    setSaveTarget(null);
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
      setSaveTarget({ name: s.name, address: '', coord: s.coord });
    }
  };

  // Saved places can be selected as either endpoint; destinations also become trip stops.
  const pickSaved = useCallback(
    (place: SavedPlace) => {
      setSavedOpen(false);
      if (planningMode === 'distance') {
        selectDistanceEndpoint(
          { id: place.id, name: place.name, address: place.address, coord: place.coord },
          searchTarget
        );
        return;
      }
      if (searchTarget === 'start') {
        const selected = { id: place.id, name: place.name, address: place.address, coord: place.coord };
        distanceRequest.current += 1;
        setStartPlace(selected);
        setSearchTarget('destination');
        setCandidate(null);
        focus(place.coord, 15);
        return;
      }
      if (useTripStore.getState().stops.some((stop) => samePlace(stop.coord, place.coord))) {
        setCandidate(null);
        toast.info('Already added', `${place.name} is already in your planned stops.`);
        return;
      }
      distanceRequest.current += 1;
      setCandidate(null);
      setEstimateDestination({ id: place.id, name: place.name, address: place.address, coord: place.coord });
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
    [addStop, focus, planningMode, previewRoute, searchTarget, selectDistanceEndpoint, toast]
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
    if (ok) {
      clear();
      setEstimateDestination(null);
      setCandidate(null);
    }
  };

  const handleAlternativePress = useCallback(
    (id: string) => {
      if (planningMode === 'distance') {
        const option = distanceAlternatives.find((item) => item.id === id);
        if (option) chooseDistanceRoute(option);
        return;
      }
      selectAlternative(id);
    },
    [chooseDistanceRoute, distanceAlternatives, planningMode, selectAlternative]
  );
  const fastestRouteId = distanceAlternatives.reduce<RouteOptionItem | null>(
    (best, option) => (!best || option.durationS < best.durationS ? option : best),
    null
  )?.id;
  const shortestRouteId = distanceAlternatives.reduce<RouteOptionItem | null>(
    (best, option) => (!best || option.distanceM < best.distanceM ? option : best),
    null
  )?.id;

  return (
    <View style={styles.root}>
      <TripMap
        cameraRef={cameraRef}
        styleKey={styleKey}
        surfaceView={false}
        initialCenter={DEFAULT_CENTER}
        stops={planningMode === 'multi' ? stops : distanceStops}
        moves={moves}
        route={planningMode === 'multi' ? route : distanceRoute}
        routeMode="plan"
        me={me}
        candidate={planningMode === 'multi' ? candidate?.coord ?? null : null}
        showNames
        alternatives={planningMode === 'multi' ? alternatives : distanceAlternatives}
        selectedAltId={planningMode === 'multi' ? selectedAltId : distanceSelectedId}
        onAlternativePress={handleAlternativePress}
        onPress={onMapPress}
        onStopPress={planningMode === 'multi' ? onStopPress : undefined}
      />

      <View
        style={[styles.top, { top: insets.top + 6 }]}
        onLayout={(event) => {
          const height = Math.ceil(event.nativeEvent.layout.height);
          setTopPanelHeight((previous) => (previous === height ? previous : height));
        }}
      >
        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => setMode('distance')}
            accessibilityRole="button"
            accessibilityState={{ selected: planningMode === 'distance' }}
            style={[styles.modeOption, planningMode === 'distance' && styles.modeOptionSelected]}
          >
            <Ionicons name="swap-horizontal-outline" size={15} color={planningMode === 'distance' ? colors.onPrimary : colors.muted} />
            <Text style={[styles.modeText, planningMode === 'distance' && styles.modeTextSelected]}>Two places</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('multi')}
            accessibilityRole="button"
            accessibilityState={{ selected: planningMode === 'multi' }}
            style={[styles.modeOption, planningMode === 'multi' && styles.modeOptionSelected]}
          >
            <Ionicons name="git-branch-outline" size={15} color={planningMode === 'multi' ? colors.onPrimary : colors.muted} />
            <Text style={[styles.modeText, planningMode === 'multi' && styles.modeTextSelected]}>Multi-stop route</Text>
          </Pressable>
        </View>
        {planningMode === 'distance' ? (
          <>
            <View style={styles.endpointStack}>
              {searchOpen && searchTarget === 'start' ? (
                <View style={styles.endpointSearch}>
                  <Text style={styles.endpointLabel}>FROM</Text>
                  <SearchBar near={me} onSelect={onSelectPlace} placeholder="Search starting place" />
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setSearchTarget('start');
                    setSearchOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Choose starting place"
                  style={styles.endpointField}
                >
                  <Ionicons name="radio-button-on" size={17} color={colors.accent} />
                  <View style={styles.endpointCopy}>
                    <Text style={styles.endpointLabel}>FROM</Text>
                    <Text style={styles.endpointValue} numberOfLines={1}>{startPlace?.name ?? 'My location'}</Text>
                  </View>
                  <Ionicons name="search-outline" size={16} color={colors.muted} />
                </Pressable>
              )}
              <View style={styles.endpointDivider}>
                <View style={styles.dividerLine} />
                <Ionicons name="arrow-down" size={15} color={colors.muted} />
                <View style={styles.dividerLine} />
              </View>
              {searchOpen && searchTarget === 'destination' ? (
                <View style={styles.endpointSearch}>
                  <Text style={styles.endpointLabel}>TO</Text>
                  <SearchBar near={me} onSelect={onSelectPlace} placeholder="Search destination" />
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setSearchTarget('destination');
                    setSearchOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Choose destination"
                  style={styles.endpointField}
                >
                  <Ionicons name="location" size={17} color={colors.primaryStrong} />
                  <View style={styles.endpointCopy}>
                    <Text style={styles.endpointLabel}>TO</Text>
                    <Text style={styles.endpointValue} numberOfLines={1}>
                      {estimateDestination?.name ?? 'Choose destination'}
                    </Text>
                  </View>
                  <Ionicons name="search-outline" size={16} color={colors.muted} />
                </Pressable>
              )}
            </View>
            {startPlace && (
              <Pressable
                onPress={() => {
                  setStartPlace(null);
                  setSearchTarget('destination');
                  setSearchOpen(false);
                }}
                style={styles.useMyLocation}
              >
                <Ionicons name="locate-outline" size={13} color={colors.accent} />
                <Text style={styles.useMyLocationText}>Use my location as start</Text>
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.searchPanel}>
            <SearchBar near={me} onSelect={onSelectPlace} placeholder="Search and add a place to your route" />
          </View>
        )}
      </View>

      {!searchOpen && topPanelHeight > 0 && (
        <MapControlGroup style={{ top: insets.top + 6 + topPanelHeight + 6 }}>
          <MapStyleSwitcher />
          <Pressable
            accessibilityLabel="Saved places"
            onPress={() => setSavedOpen(true)}
            style={({ pressed }) => [styles.sideBtn, pressed && styles.sideBtnPressed]}
          >
            <Ionicons name="bookmark-outline" size={20} color={colors.primaryStrong} />
          </Pressable>
          <Pressable
            accessibilityLabel="Vehicle type"
            onPress={() => setVehOpen(true)}
            style={({ pressed }) => [styles.sideBtn, pressed && styles.sideBtnPressed]}
          >
            <VehicleIcon name={vehicle} size={20} color={colors.primaryStrong} />
            {vehicle !== 'car' && <View style={styles.sideDot} />}
          </Pressable>
          <LocateButton onPress={recenter} />
        </MapControlGroup>
      )}

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
        onSelect={selectVehicle}
        onClose={() => setVehOpen(false)}
      />

      <SavedPlacesSheet
        visible={savedOpen}
        onSelect={pickSaved}
        onSaveCurrentLocation={() => {
          setSavedOpen(false);
          void saveCurrentLocation();
        }}
        onClose={() => setSavedOpen(false)}
      />

      <SavePlaceSheet
        visible={!!saveTarget}
        initialName={saveTarget?.name ?? ''}
        categories={savedCategories}
        onSave={savePlaceWithDetails}
        onClose={() => setSaveTarget(null)}
      />

      {planningMode === 'distance' && estimateDestination?.coord ? (
        <View style={[styles.sheet, styles.distanceSheet, { bottom: insets.bottom + 12 }]}>
          <View style={styles.distanceHead}>
            <Text style={styles.title}>{distanceRoute ? 'Route options' : 'Planning route'}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear selected route"
              hitSlop={10}
              onPress={clearDistanceRoute}
              style={styles.clearRouteButton}
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          </View>
          {estimateDestination?.coord && !startPlace && !me && (
            <Text style={styles.hint}>Waiting for your current location. Choose a start place instead.</Text>
          )}
          {distanceLoading && <Text style={styles.hint}>Finding fastest and shortest routes…</Text>}
          {!!distanceError && <Text style={styles.error}>{distanceError}</Text>}
          {distanceAlternatives.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.cardScroll}
              contentContainerStyle={styles.distanceCardRow}
            >
              {distanceAlternatives.map((option) => {
                const selected = option.id === distanceSelectedId;
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
                    onPress={() => chooseDistanceRoute(option)}
                    style={[styles.card, selected && styles.cardOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.cardTitle}>{label}</Text>
                    <Text style={styles.cardMeta}>{formatDistance(option.distanceM)}</Text>
                    <Text style={styles.cardDetail}>{formatDuration(option.durationS)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {distanceRoute && (
            <View style={styles.distanceActions}>
              <AnimatedButton
                label="Start navigation"
                onPress={startDistanceNavigation}
                icon={<Ionicons name="navigate-outline" size={17} color={colors.onPrimary} />}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
      ) : (candidate || pending.length > 0) && (
        <MotiView
          from={{ opacity: 0, translateY: 40, scale: 0.98 }}
          animate={{ opacity: 1, translateY: 0, scale: 1 }}
          transition={{ type: 'timing', duration: 220 }}
          style={[styles.sheet, { bottom: insets.bottom + 12, maxHeight: expanded ? '78%' : 340 }]}
        >
        {candidate ? (
          <>
            <Text style={styles.title}>{candidate.name}</Text>
            {!!candidate.address && <Text style={styles.hint}>{candidate.address}</Text>}
            <AnimatedButton label="Add to route" onPress={confirmCandidate} style={{ marginTop: 14 }} />
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
                onPress={cancelCandidate}
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', left: 12, right: 12 },
  modeSwitch: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 7,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  modeOption: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
  },
  modeOptionSelected: { backgroundColor: colors.primaryStrong },
  modeText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  modeTextSelected: { color: colors.onPrimary },
  endpointStack: {
    gap: 4,
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
  endpointSearch: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  endpointDivider: { height: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  dividerLine: { height: 1, flex: 1, backgroundColor: colors.border },
  searchPanel: {
    padding: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.float,
  },
  endpointCopy: { flex: 1, minWidth: 0 },
  endpointLabel: { fontSize: 9, color: colors.muted, fontWeight: '800', letterSpacing: 0.8 },
  endpointValue: { color: colors.text, fontSize: 12, fontWeight: '700', marginTop: 1 },
  useMyLocation: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginBottom: 5, paddingHorizontal: 4 },
  useMyLocationText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
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
  distanceSheet: { padding: 16 },
  distanceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clearRouteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  distanceActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
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
  distanceCardRow: { flexGrow: 1, justifyContent: 'center', gap: 8 },
  card: {
    padding: 12,
    minWidth: 150,
    borderRadius: radius.md,
    ...cardStyle,
  },
  cardOn: { borderColor: colors.primaryStrong },
  cardTitle: { color: colors.text, fontWeight: '700' },
  cardMeta: { color: colors.accent, marginTop: 4, fontWeight: '600' },
  cardDetail: { color: colors.muted, marginTop: 3, fontSize: 12, fontWeight: '600' },
  list: { marginTop: 10 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 5 },
  savedBtn: { flex: 1, borderColor: colors.primaryStrong, backgroundColor: colors.primarySoft },
  arrow: { width: 16, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  item: { color: colors.text, flex: 1 },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
});
