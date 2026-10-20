import { router, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { listTrips, type TripRow } from '../services/history';
import { getProfile } from '../services/profile';
import { colors, radius } from '../theme/colors';
import { formatClock, formatDistance, formatDuration } from '../utils/format';
import { CreditBar } from '../components/CreditBar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_JOIN_KEY } from '../services/pendingJoin';
import { UpdateBanner } from '../components/UpdateBanner';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const [firstName, setFirstName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Reloads every time the home screen comes back into view, so new trips appear.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        setLoading(true);
        try {
          const [profile, list] = await Promise.all([getProfile(), listTrips()]);
          if (!live) return;
          setFirstName(profile?.fullName.split(' ')[0] ?? '');
          setAvatar(profile?.avatarUrl ?? null);
          setTrips(list);
        } catch {
          // Keep whatever was loaded before.
        } finally {
          if (live) setLoading(false);
        }
      })();
      return () => {
        live = false;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(PENDING_JOIN_KEY).then((token) => {
        if (token) router.push(`/join/${token}`);
      });
    }, [])
  );

  const totalKm = trips.reduce((sum, t) => sum + (t.planned_distance_m ?? 0), 0);
  const totalStops = trips.reduce((sum, t) => sum + t.visited_count, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>BERZH MATE</Text>
            <Text style={styles.title}>
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/account')}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{(firstName || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 400 }} style={styles.statsCard}>
          <CreditBar onPress={() => router.push('/usage')} />
          <Stat label="Trips" value={String(trips.length)} />
          <Stat label="Planned km" value={totalKm ? formatDistance(totalKm) : '0 km'} />
          <Stat label="Stops done" value={String(totalStops)} />
        </MotiView>

        <View style={styles.actions}>
          <AnimatedButton label="Berzh Meter" onPress={() => router.push('/meter')} style={{ flex: 1 }} />
          <AnimatedButton label="Plan a route" variant="ghost" onPress={() => router.push('/plan')} style={{ flex: 1 }} />
        </View>
        <AnimatedButton label="Settings" variant="ghost" onPress={() => router.push('/settings')} />
        <AnimatedButton label="Trip groups" variant="ghost" onPress={() => router.push('/groups')} />

        <Text style={styles.section}>Recent trips</Text>

        {!loading && trips.length === 0 && (
          <Text style={styles.empty}>No trips yet. Plan a route and start navigating to see your history here.</Text>
        )}

        {trips.map((t, i) => (
          <MotiView
            key={t.id}
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350, delay: i * 60 }}
            style={styles.tripCard}
          >
            <View style={styles.tripTop}>
              <Text style={styles.tripName} numberOfLines={1}>{t.name ?? 'Trip'}</Text>
              <Text style={[styles.badge, t.status === 'completed' ? styles.badgeDone : styles.badgeEnded]}>
                {t.status === 'completed' ? 'Completed' : 'Ended early'}
              </Text>
            </View>
            <Text style={styles.tripMeta}>
              {new Date(t.finished_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {formatClock(new Date(t.finished_at).getTime())}
            </Text>
            <View style={styles.tripStats}>
              <Text style={styles.chip}>{t.vehicle ?? 'car'}</Text>
              <Text style={styles.chip}>{t.visited_count}/{t.stop_count} stops</Text>
              {t.planned_distance_m != null && <Text style={styles.chip}>{formatDistance(t.planned_distance_m)}</Text>}
              {t.planned_duration_s != null && <Text style={styles.chip}>{formatDuration(t.planned_duration_s)}</Text>}
            </View>
          </MotiView>
        ))}
      </ScrollView>
      <UpdateBanner />
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { color: colors.primary, letterSpacing: 3, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: colors.surfaceAlt, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.accent, fontSize: 18, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 10 },
  section: { color: colors.text, fontWeight: '700', fontSize: 16, marginTop: 6 },
  empty: { color: colors.muted, lineHeight: 20 },
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tripName: { color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  badgeDone: { color: colors.bg, backgroundColor: colors.primary },
  badgeEnded: { color: colors.bg, backgroundColor: colors.accent },
  tripMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  tripStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: {
    color: colors.text,
    fontSize: 12,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
});