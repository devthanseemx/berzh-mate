import { router, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listFareTrips, type FareTripRow } from '../../services/fares';
import { cardStyle, colors, radius } from '../../theme/colors';
import { BackButton } from '../../components/BackButton';
import { money } from '../../utils/fare';
import { formatDistance, formatDuration } from '../../utils/format';

type DateFilter = 'all' | '7days' | '30days' | 'month';
type TripSort = 'newest' | 'fareHigh' | 'fareLow' | 'rate';

export default function History() {
  const [trips, setTrips] = useState<FareTripRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortBy, setSortBy] = useState<TripSort>('newest');

  const visibleTrips = useMemo(() => {
    const now = new Date();
    const filtered = trips.filter((trip) => {
      const endedAt = new Date(trip.ended_at);
      if (dateFilter === '7days') return endedAt.getTime() >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
      if (dateFilter === '30days') return endedAt.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
      if (dateFilter === 'month') {
        return endedAt.getFullYear() === now.getFullYear() && endedAt.getMonth() === now.getMonth();
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'fareHigh') return b.fare - a.fare;
      if (sortBy === 'fareLow') return a.fare - b.fare;
      if (sortBy === 'rate') return a.rate_name.localeCompare(b.rate_name);
      return Date.parse(b.ended_at) - Date.parse(a.ended_at);
    });
  }, [dateFilter, sortBy, trips]);

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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Trip history</Text>
          <Text style={styles.count}>{visibleTrips.length} trips</Text>
        </View>
        <Text style={styles.sectionLabel}>DATE</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {([
            ['all', 'All time'],
            ['7days', '7 days'],
            ['30days', '30 days'],
            ['month', 'This month'],
          ] as const).map(([value, label]) => (
            <FilterChip
              key={value}
              label={label}
              selected={dateFilter === value}
              onPress={() => setDateFilter(value)}
            />
          ))}
        </ScrollView>
        <Text style={styles.sectionLabel}>SORT BY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {([
            ['newest', 'Newest'],
            ['fareHigh', 'Fare: high'],
            ['fareLow', 'Fare: low'],
            ['rate', 'Rate'],
          ] as const).map(([value, label]) => (
            <FilterChip
              key={value}
              label={label}
              selected={sortBy === value}
              onPress={() => setSortBy(value)}
            />
          ))}
        </ScrollView>
        {error && <Text style={styles.error}>{error}</Text>}
        {!error && visibleTrips.length === 0 && (
          <Text style={styles.hint}>
            {trips.length === 0
              ? 'No meter trips yet. Finished trips appear here.'
              : 'No trips match the selected filters.'}
          </Text>
        )}

        {visibleTrips.map((t, i) => (
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
              <View style={styles.cardHeader}>
                <Text style={styles.date}>
                  {new Date(t.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' · '}
                  {new Date(t.ended_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                </Text>
                <Text style={styles.fare}>{money(t.fare)}</Text>
              </View>
              <Text style={styles.rate}>{t.rate_name}</Text>
              <View style={styles.metrics}>
                <Text style={styles.meta}>{formatDistance(t.distance_m)}</Text>
                <View style={styles.dot} />
                <Text style={styles.meta}>{formatDuration(t.duration_s)}</Text>
              </View>
              <Text style={styles.breakdown}>
                {money(t.price_per_km)} per km{t.base_fare > 0 ? ` · ${money(t.base_fare)} base fare` : ''}
              </Text>
            </Pressable>
          </MotiView>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 64, gap: 10, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  count: { color: colors.muted, fontSize: 12 },
  sectionLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 4 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primaryStrong },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: colors.primaryStrong },
  hint: { color: colors.muted },
  error: { color: colors.danger },
  card: {
    padding: 14,
    borderRadius: radius.md,
    ...cardStyle,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  date: { color: colors.muted, fontSize: 12, flex: 1 },
  rate: { color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 4 },
  metrics: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.muted },
  meta: { color: colors.muted, fontSize: 12 },
  breakdown: { color: colors.muted, fontSize: 11, marginTop: 7 },
  fare: { color: colors.accent, fontWeight: '800', fontSize: 17 },
});