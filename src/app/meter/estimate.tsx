import Mapbox from '@rnmapbox/maps';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { AnimatedButton } from '../../components/AnimatedButton';
import { MapStyleSwitcher } from '../../components/MapStyleSwitcher';
import { SearchBar } from '../../components/SearchBar';
import { DEFAULT_CENTER, TripMap } from '../../components/TripMap';
import { fetchRoute, reverseGeocode, routeParams } from '../../services/geoapify';
import { requestNavigationPermissions } from '../../services/location';
import { startMeterTracking } from '../../services/meterLocation';
import { listRates, type Rate } from '../../services/rates';
import { getQuickLocation } from '../../services/whereAmI';
import { useMapPrefs } from '../../store/mapPrefs';
import { useMeter } from '../../store/meter';
import { colors, radius } from '../../theme/colors';
import type { LngLat, RouteInfo, Stop } from '../../types';
import { fareFor, money } from '../../utils/fare';
import { formatDistance, formatDuration } from '../../utils/format';

type Dest = { name: string; address: string; coord: LngLat };

// Estimates the fare to a destination, chosen by search or by tapping the map.
// From here, the meter can be started directly.
export default function Estimate() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const styleKey = useMapPrefs((s) => s.styleKey);
  const activeRateId = useMeter((s) => s.activeRateId);

  const [rates, setRates] = useState<Rate[]>([]);
  const [me, setMe] = useState<LngLat | null>(null);
  const [dest, setDest] = useState<Dest | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rate = rates.find((r) => r.id === activeRateId) ?? null;

  useEffect(() => {
    listRates().then(setRates).catch(() => {});
    getQuickLocation().then((p) => {
      if (!p) return;
      setMe(p);
      cameraRef.current?.setCamera({ centerCoordinate: p, zoomLevel: 14, animationDuration: 600 });
    });
  }, []);

  const stops: Stop[] = useMemo(
    () => (dest ? [{ id: 'dest', name: dest.name, coord: dest.coord, status: 'pending' }] : []),
    [dest]
  );

  const planTo = async (coord: LngLat, name: string, address = '') => {
    setDest({ name, address, coord });
    setRoute(null);
    setError(null);
    setBusy(true);
    cameraRef.current?.setCamera({ centerCoordinate: coord, zoomLevel: 13, animationDuration: 600 });
    try {
      const start = me ?? (await getQuickLocation());
      if (!start) throw new Error('Turn on location to estimate from where you are.');
      setMe(start);

      const { mode, extra } = routeParams('car', 'balanced');
      const raw = await fetchRoute([start, coord], mode, extra);
      setRoute({
        legs: [raw.geometry],
        steps: [],
        legDistanceM: [raw.distanceM],
        legDurationS: [raw.durationS],
        distanceM: raw.distanceM,
        durationS: raw.durationS,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Tapping the map names the point and plans the fare to it.
  const onMapPress = async (e: any) => {
    if (busy) return;
    const coord = e.geometry.coordinates as LngLat;
    setBusy(true);
    const name = (await reverseGeocode(coord).catch(() => null)) ?? 'Pinned location';
    setBusy(false);
    planTo(coord, name);
  };

  const clear = () => {
    setDest(null);
    setRoute(null);
    setError(null);
  };

  const startMeter = async () => {
    if (!rate) {
      router.push('/meter/rates');
      return;
    }
    const ok = await requestNavigationPermissions();
    if (!ok) {
      Alert.alert('Location needed', 'Allow location to measure the trip.');
      return;
    }
    useMeter.getState().startTrip({
      name: rate.name,
      pricePerKm: rate.price_per_km,
      baseFare: rate.base_fare,
    });
    await startMeterTracking();
    router.replace('/meter');
  };

  const fare = route && rate ? fareFor(route.distanceM, rate.price_per_km, rate.base_fare) : null;

  return (
    <View style={styles.root}>
      <TripMap
        cameraRef={cameraRef}
        styleKey={styleKey}
        initialCenter={me ?? DEFAULT_CENTER}
        stops={stops}
        route={route}
        routeMode="plan"
        me={me}
        candidate={null}
        showNames
        onPress={onMapPress}
      />

      <View style={styles.top}>
        <SearchBar
          near={me}
          onSelect={(p) => {
            if (p.coord) planTo(p.coord, p.name, p.address);
          }}
        />
        <View style={{ marginTop: 8 }}>
          <MapStyleSwitcher />
        </View>
      </View>

      <View style={styles.sheet}>
        {busy && <Text style={styles.hint}>Finding the route…</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
        {!dest && !busy && <Text style={styles.hint}>Search a place, or tap anywhere on the map.</Text>}

        {dest && (
          <>
            <Text style={styles.title} numberOfLines={1}>
              {dest.name}
            </Text>
            {!!dest.address && (
              <Text style={styles.hint} numberOfLines={1}>
                {dest.address}
              </Text>
            )}

            {route && (
              <Text style={styles.accent}>
                {formatDistance(route.distanceM)} · {formatDuration(route.durationS)}
              </Text>
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

            <AnimatedButton
              label={rate ? `Start meter · ${rate.name}` : 'Choose a rate'}
              onPress={startMeter}
              style={{ marginTop: 14 }}
            />
            <AnimatedButton label="Clear" variant="ghost" onPress={clear} style={{ marginTop: 10 }} />
            <Text style={styles.note}>
              The estimate uses the planned road distance. The meter measures the distance you actually drive.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { position: 'absolute', top: 12, left: 12, right: 12 },
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
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  accent: { color: colors.accent, fontWeight: '700', marginTop: 4 },
  fareBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  fareLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1, fontWeight: '700' },
  fare: { color: colors.accent, fontSize: 30, fontWeight: '800', marginTop: 4 },
  breakdown: { color: colors.muted, fontSize: 12, marginTop: 4 },
  hint: { color: colors.muted, marginTop: 6 },
  note: { color: colors.muted, fontSize: 11, marginTop: 10 },
  error: { color: colors.danger, marginTop: 6 },
});