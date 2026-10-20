import { router, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listFareTrips, type FareTripRow } from '../../services/fares';
import { cardStyle, colors, radius } from '../../theme/colors';
import { BackButton } from '../../components/BackButton';
import { money } from '../../utils/fare';
import { formatDistance, formatDuration } from '../../utils/format';

export default function History() {
  const [trips, setTrips] = useState<FareTripRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      listFareTrips()
        .then((t) => {
          setTrips(t);
          setError(null);
        })
        .catch((e) => setError(e.message));
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe}>
      <BackButton />
      <BackButton />
      <ScrollView contentContainerStyle={styles.content}>
        {error && <Text style={styles.error}>{error}</Text>}
        {!error && trips.length === 0 && (
          <Text style={styles.hint}>No meter trips yet. Finished trips appear here.</Text>
        )}

        {trips.map((t, i) => (
          <MotiView
            key={t.id}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300, delay: i * 40 }}
          >
            <Pressable
              onPress={() => router.push({ pathname: '/meter/[id]', params: { id: t.id } })}
              style={styles.card}
            >
              <Text style={styles.date}>
                {new Date(t.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                {' · '}
                {new Date(t.ended_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <Text style={styles.rate}>{t.rate_name}</Text>
              <Text style={styles.meta}>
                {formatDistance(t.distance_m)} · {formatDuration(t.duration_s)}
              </Text>
              <Text style={styles.fare}>{money(t.fare)}</Text>
            </Pressable>
          </MotiView>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 64, gap: 10 },
  hint: { color: colors.muted },
  error: { color: colors.danger },
  card: {
    padding: 14,
    borderRadius: radius.md,
    ...cardStyle,
  },
  date: { color: colors.muted, fontSize: 12 },
  rate: { color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 4 },
  meta: { color: colors.muted, marginTop: 4 },
  fare: { color: colors.accent, fontWeight: '800', fontSize: 18, marginTop: 6 },
});