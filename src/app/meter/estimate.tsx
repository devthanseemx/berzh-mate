import Mapbox from '@rnmapbox/maps';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedButton } from '../../components/AnimatedButton';
import { MapStyleSwitcher } from '../../components/MapStyleSwitcher';
import { SearchBar } from '../../components/SearchBar';
import { DEFAULT_CENTER, TripMap } from '../../components/TripMap';
import { fetchRoute, routeParams } from '../../services/geoapify';
import type { PlaceResult } from '../../services/mapbox';
import { listRates, type Rate } from '../../services/rates';
import { getMyLocation } from '../../services/whereAmI';
import { useMapPrefs } from '../../store/mapPrefs';
import { useMeter } from '../../store/meter';
import { colors, radius } from '../../theme/colors';
import type { LngLat, RouteInfo, Stop } from '../../types';
import { fareFor, money } from '../../utils/fare';
import { formatDistance, formatDuration } from '../../utils/format';

// Shows the route and fare from where you are to a chosen destination.
export default function Estimate() {
  const cameraRef = useRef<Mapbox.Camera>(null);
  const styleKey = useMapPrefs((s) => s.styleKey);
  const activeRateId = useMeter((s) => s.activeRateId);

  const [rates, setRates] = useState<Rate[]>([]);
  const [me, setMe] = useState<LngLat | null>(null);
  const [dest, setDest] = useState<PlaceResult | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rate = rates.find((r) => r.id === activeRateId) ?? null;

  useEffect(() => {
    listRates().then(setRates).catch(() => {});
    getMyLocation().then((p) => {
      if (!p) return;
      setMe(p);
      cameraRef.current?.setCamera({ centerCoordinate: p, zoomLevel: 14, animationDuration: 600 });
    });
  }, []);

  const stops: Stop[] = useMemo(
    () => (dest?.coord ? [{ id: 'dest', name: dest.name, coord: dest.coord, status: 'pending' }] : []),
    [dest]
  );

  const choose = async (p: PlaceResult) => {
    if (!p.coord) return;
    setDest(p);
    setError(null);
    setRoute(null);
    setBusy(true);
    cameraRef.current?.setCamera({ centerCoordinate: p.coord, zoomLevel: 13, animationDuration: 600 });
    try {
      const start = me ?? (await getMyLocation());
      if (!start) throw new Error('Turn on location to estimate from where you are.');
      setMe(start);

      const { mode, extra } = routeParams('car', 'balanced');
      const raw = await fetchRoute([start, p.coord], mode, extra);
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

  const clear = () => {
    setDest(null);
    setRoute(null);
    setError(null);
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
      />

      <View style={styles.top}>
        <SearchBar near={me} onSelect={choose} />
        <View style={{ marginTop: 8 }}>
          <MapStyleSwitcher />
        </View>
      </View>

      <View style={styles.sheet}>
        {busy && <Text style={styles.hint}>Finding the route…</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        {!dest && !busy && <Text style={styles.hint}>Search for a destination to see the distance and fare.</Text>}

        {route && (
          <>
            <Text style={styles.title} numberOfLines={1}>{dest?.name}</Text>
            <Text style={styles.accent}>
              {formatDistance(route.distanceM)} · {formatDuration(route.durationS)}
            </Text>

            {rate && fare !== null ? (
              <View style={styles.fareBox}>
                <Text style={styles.fareLabel}>ESTIMATED FARE · {rate.name.toUpperCase()}</Text>
                <Text style={styles.fare}>{money(fare)}</Text>
                <Text style={styles.breakdown}>
                  {rate.base_fare > 0 ? `${money(rate.base_fare)} base + ` : ''}
                  {(route.distanceM / 1000).toFixed(2)} km × {money(rate.price_per_km)}
                </Text>
              </View>
            ) : (
              <Text style={styles.hint}>Choose a rate on the Rates screen to see the fare.</Text>
            )}

            <Text style={styles.note}>
              This is an estimate from the planned road distance. The meter measures the distance you actually drive.
            </Text>
          </>
        )}

        {(dest || route) && <AnimatedButton label="Clear" variant="ghost" onPress={clear} style={{ marginTop: 12 }} />}
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