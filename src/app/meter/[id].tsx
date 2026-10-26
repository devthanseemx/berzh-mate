import Mapbox from '@rnmapbox/maps';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_CENTER, TripMap } from '../../components/TripMap';
import { MapControlGroup } from '../../components/MapControlGroup';
import { MapStyleSwitcher } from '../../components/MapStyleSwitcher';
import { getFareTrip, type FareTrip } from '../../services/fares';
import { useMapPrefs } from '../../store/mapPrefs';
import { cardStyle, colors, radius } from '../../theme/colors';
import { BackButton } from '../../components/BackButton';
import type { RouteInfo } from '../../types';
import { money } from '../../utils/fare';
import { formatDistance, formatDuration } from '../../utils/format';

export default function FareDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cameraRef = useRef<Mapbox.Camera>(null);
  const styleKey = useMapPrefs((s) => s.styleKey);
  const [trip, setTrip] = useState<FareTrip | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFareTrip(id).then(setTrip).catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!trip) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primaryStrong} />
      </View>
    );
  }

  const km = trip.distance_m / 1000;
  const route: RouteInfo | null =
    trip.path.length > 1
      ? {
          legs: [trip.path],
          steps: [],
          legDistanceM: [trip.distance_m],
          legDurationS: [trip.duration_s],
          distanceM: trip.distance_m,
          durationS: trip.duration_s,
        }
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <BackButton />
      <View style={styles.mapWrap}>
        <TripMap
          cameraRef={cameraRef}
          styleKey={styleKey}
          initialCenter={trip.path[0] ?? DEFAULT_CENTER}
          stops={[]}
          route={route}
          routeMode="plan"
          me={null}
          candidate={null}
          showNames={false}
        />
        <MapControlGroup style={{ top: 12 }}>
          <MapStyleSwitcher />
        </MapControlGroup>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.fare}>{money(trip.fare)}</Text>
        <Text style={styles.breakdown}>
          {trip.base_fare > 0 ? `${money(trip.base_fare)} base + ` : ''}
          {km.toFixed(2)} km × {money(trip.price_per_km)}
        </Text>

        <View style={styles.card}>
          <Row label="Rate" value={trip.rate_name} />
          <Row label="Distance" value={formatDistance(trip.distance_m)} />
          <Row label="Duration" value={formatDuration(trip.duration_s)} />
          <Row label="Started" value={new Date(trip.started_at).toLocaleString()} />
          <Row label="Ended" value={new Date(trip.ended_at).toLocaleString()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  mapWrap: { height: 300 },
  content: { padding: 20, gap: 12 },
  fare: { color: colors.accent, fontSize: 36, fontWeight: '800' },
  breakdown: { color: colors.muted },
  card: {
    marginTop: 8,
    padding: 16,
    borderRadius: radius.lg,
    ...cardStyle,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { color: colors.muted },
  rowValue: { color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  error: { color: colors.danger, padding: 20 },
});