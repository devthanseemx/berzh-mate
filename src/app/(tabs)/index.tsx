import { Ionicons } from '@expo/vector-icons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { listTrips, type TripRow } from '../../services/history';
import { listFareTrips, type FareTripRow } from '../../services/fares';
import { VEHICLES, type VehicleKey } from '../../services/geoapify';
import { getProfile } from '../../services/profile';
import { money } from '../../utils/fare';
import { cardStyle, colors, radius } from '../../theme/colors';
import { fonts } from '../../theme/font';
import { formatClock, formatDistance, formatDuration } from '../../utils/format';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PENDING_JOIN_KEY } from '../../services/pendingJoin';
import { UpdateBanner } from '../../components/UpdateBanner';
import { SpendingChart, type ChartPeriod } from '../../components/SpendingChart';
import { DistanceChart } from '../../components/DistanceChart';
import { VEHICLE_ICON } from '../../components/vehicleIcons';
import { HOME_PLACE_CATEGORIES, useSavedPlaces } from '../../store/savedPlaces';
import { HomeSkeleton } from '../../components/HomeSkeleton';
import { SavedPlacesSheet } from '../../components/SavedPlacesSheet';

function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

// One-tile shortcut into each main area of the app.
const ACTIONS: { icon: keyof typeof Ionicons.glyphMap; label: string; href: string }[] = [
  { icon: 'map-outline', label: 'Plan route', href: '/plan' },
  { icon: 'speedometer-outline', label: 'Start meter', href: '/meter' },
  { icon: 'people-outline', label: 'New group', href: '/groups' },
  { icon: 'time-outline', label: 'History', href: '/meter/history' },
];

// Period tabs above the stats/chart.
const PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
];

// Human label for the stored vehicle key ('three_wheeler' → 'Three wheeler').
function vehicleLabel(v: string | null): string {
  if (!v) return 'Car';
  return VEHICLES[v as VehicleKey]?.label ?? 'Car';
}

// Monday 00:00 of the selected week (offset 0 = this week).
function mondayOf(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}

export default function Home() {
  const [firstName, setFirstName] = useState('');
  const [greetingText, setGreetingText] = useState(greeting);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [rides, setRides] = useState<FareTripRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [period, setPeriod] = useState<ChartPeriod>('week');
  const [offset, setOffset] = useState(0);
  const savedPlaces = useSavedPlaces((s) => s.places);
  const homePlaces = savedPlaces.filter(
    (place) => HOME_PLACE_CATEGORIES.some((category) => category === place.category)
  );
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [mapsLinkOpen, setMapsLinkOpen] = useState(false);
  const [mapsLink, setMapsLink] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setGreetingText(greeting()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Reloads every time the home screen comes back into view, so new trips appear.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        setLoading(true);
        try {
          const [profile, list, rideList] = await Promise.all([getProfile(), listTrips(), listFareTrips()]);
          if (!live) return;
          setFirstName(profile?.fullName.split(' ')[0] ?? '');
          setAvatar(profile?.avatarUrl ?? null);
          setTrips(list);
          setRides(rideList);
        } catch {
          // Keep whatever was loaded before.
        } finally {
          if (live) {
            setLoading(false);
            setReady(true);
          }
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

  // Range for the selected period (week/month/year) and how far back it is.
  const rangeStart = useMemo(() => {
    if (period === 'week') return mondayOf(offset);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (period === 'month') {
      d.setDate(1);
      d.setMonth(d.getMonth() + offset);
    } else {
      d.setDate(1);
      d.setMonth(0);
      d.setFullYear(d.getFullYear() + offset);
    }
    return d;
  }, [period, offset]);

  const rangeEnd = useMemo(() => {
    const d = new Date(rangeStart);
    if (period === 'week') d.setDate(d.getDate() + 7);
    else if (period === 'month') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [rangeStart, period]);

  const rangeTrips = useMemo(() => {
    const from = rangeStart.getTime();
    const to = rangeEnd.getTime();
    return trips.filter((t) => {
      const f = new Date(t.finished_at).getTime();
      return f >= from && f < to;
    });
  }, [trips, rangeStart, rangeEnd]);

  const totalKm = rangeTrips.reduce((sum, t) => sum + (t.planned_distance_m ?? 0), 0);
  const totalStops = rangeTrips.reduce((sum, t) => sum + t.visited_count, 0);

  // Recent trips: a few at first, the rest behind "Show all".
  const visibleTrips = showAllTrips ? trips : trips.slice(0, 3);
  const recentRides = rides.slice(0, 3);

  const rangeLabel =
    period === 'week'
      ? offset === 0
        ? 'This week'
        : `${rangeStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(
            rangeEnd.getTime() - 86400000
          ).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : period === 'month'
        ? rangeStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : offset === 0
          ? 'This year'
          : String(rangeStart.getFullYear());

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!ready ? (
          <HomeSkeleton />
        ) : (
          <>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>BERZH MATE</Text>
            <Text style={styles.greeting}>{greetingText}</Text>
            {firstName ? <Text style={styles.greetingName}>{firstName}</Text> : null}
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

        {/* One entry opens the full categorized saved-place picker. */}
        {homePlaces.length > 0 && (
          <View style={styles.savedPlacesSection}>
            <Text style={styles.section}>Saved places</Text>
            <Pressable
              onPress={() => setSavedPlacesOpen(true)}
              style={({ pressed }) => [styles.savedPlacesButton, pressed && styles.savedChipPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${homePlaces.length} saved places`}
            >
              <View style={styles.savedPlacesIcon}>
                <Ionicons name="bookmark" size={19} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedPlacesTitle}>Your places</Text>
                <Text style={styles.savedPlacesMeta}>
                  {homePlaces.length} place{homePlaces.length === 1 ? '' : 's'} · Home, office and favorites
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          </View>
        )}

        {/* Quick actions — one tap into each area */}
        <View style={styles.actions}>
          {ACTIONS.map((a, i) => (
            <MotiView
              key={a.label}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 320, delay: i * 50 }}
              style={{ flex: 1 }}
            >
              <Pressable onPress={() => router.push(a.href as any)} style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
                <View style={styles.actionIcon}>
                  <Ionicons name={a.icon} size={20} color={colors.accent} />
                </View>
                <Text style={styles.actionLabel} numberOfLines={1}>
                  {a.label}
                </Text>
              </Pressable>
            </MotiView>
          ))}
        </View>

        <Pressable
          onPress={() => setMapsLinkOpen(true)}
          style={({ pressed }) => [styles.sharedMapWidget, pressed && styles.actionPressed]}
          accessibilityRole="button"
          accessibilityLabel="Open a shared Google Maps location"
        >
          <View style={styles.sharedMapIcon}>
            <Ionicons name="link-outline" size={17} color={colors.accent} />
          </View>
          <View style={styles.sharedMapCopy}>
            <Text style={styles.sharedMapTitle}>Shared a place with you?</Text>
            <Text style={styles.sharedMapHint}>Open a Google Maps link</Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>

        {/* Period selector — Week / Month / Year drives the stats and the chart */}
        <View style={styles.periodSeg}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => {
                setPeriod(p.key);
                setOffset(0);
              }}
              style={[styles.periodPill, period === p.key && styles.periodPillOn]}
            >
              <Text style={[styles.periodPillText, period === p.key && styles.periodPillTextOn]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.weekRow}>
          <Pressable onPress={() => setOffset((o) => o - 1)} style={styles.weekArrow} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={colors.text} />
          </Pressable>
          <Text style={styles.weekLabel}>{rangeLabel}</Text>
          <Pressable
            onPress={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset === 0}
            style={styles.weekArrow}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={16} color={offset === 0 ? colors.border : colors.text} />
          </Pressable>
        </View>

        <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 400 }} style={styles.statsCard}>
          <Stat label="Trips" value={String(rangeTrips.length)} />
          <View style={styles.statDivider} />
          <Stat label="Planned km" value={totalKm ? formatDistance(totalKm) : '0 km'} />
          <View style={styles.statDivider} />
          <Stat label="Stops done" value={String(totalStops)} />
        </MotiView>

        <SpendingChart period={period} start={rangeStart} end={rangeEnd} />
        <DistanceChart period={period} start={rangeStart} end={rangeEnd} trips={rangeTrips} />

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Recent trips</Text>
          {trips.length > 3 && (
            <Pressable onPress={() => setShowAllTrips((v) => !v)} style={styles.showMore} hitSlop={8}>
              <Text style={styles.showMoreText}>{showAllTrips ? 'Show less' : `Show all ${trips.length}`}</Text>
              <Ionicons
                name={showAllTrips ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.accent}
              />
            </Pressable>
          )}
        </View>

        {!loading && trips.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="location-outline" size={26} color={colors.muted} />
            <Text style={styles.empty}>No trips yet. Plan a route and start navigating to see your history here.</Text>
          </View>
        )}

        {visibleTrips.map((t, i) => (
          <MotiView
            key={t.id}
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350, delay: Math.min(i, 6) * 60 }}
            style={styles.tripCard}
          >
            <View style={styles.tripTop}>
              <View style={styles.tripIcon}>
                <MaterialCommunityIcons
                  name={(VEHICLE_ICON[t.vehicle ?? 'car'] ?? 'car-sports') as any}
                  size={19}
                  color={colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.tripName} numberOfLines={1}>{t.name ?? 'Trip'}</Text>
                <Text style={styles.tripMeta}>
                  {new Date(t.finished_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {formatClock(new Date(t.finished_at).getTime())}
                </Text>
              </View>
              <View style={[styles.badge, t.status === 'completed' ? styles.badgeDone : styles.badgeEnded]}>
                <View style={[styles.badgeDot, { backgroundColor: t.status === 'completed' ? colors.success : colors.danger }]} />
                <Text style={[styles.badgeText, t.status === 'completed' ? styles.badgeTextDone : styles.badgeTextEnded]}>
                  {t.status === 'completed' ? 'Completed' : 'Ended early'}
                </Text>
              </View>
            </View>

            <View style={styles.tripStats}>
              <Metric label="Vehicle" value={vehicleLabel(t.vehicle)} />
              <Metric label="Stops" value={`${t.visited_count}/${t.stop_count}`} />
              <Metric label="Distance" value={t.planned_distance_m != null ? formatDistance(t.planned_distance_m) : '—'} />
              <Metric label="Time" value={t.planned_duration_s != null ? formatDuration(t.planned_duration_s) : '—'} />
            </View>
          </MotiView>
        ))}

        {/* Recent rides — the latest meter trips */}
        {recentRides.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.section}>Recent rides</Text>
              <Pressable onPress={() => router.push('/meter/history')} style={styles.showMore} hitSlop={8}>
                <Text style={styles.showMoreText}>History</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.accent} />
              </Pressable>
            </View>
            {recentRides.map((r, i) => (
              <MotiView
                key={r.id}
                from={{ opacity: 0, translateY: 12 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 320, delay: i * 50 }}
              >
                <Pressable
                  onPress={() => router.push(`/meter/${r.id}`)}
                  style={({ pressed }) => [styles.rideCard, pressed && styles.ridePressed]}
                >
                  <View style={styles.rideIcon}>
                    <Ionicons name="speedometer-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tripName} numberOfLines={1}>{r.rate_name || 'Meter ride'}</Text>
                    <Text style={styles.tripMeta}>
                      {new Date(r.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                      {formatDistance(r.distance_m)}
                    </Text>
                  </View>
                  <Text style={styles.rideFare}>{money(r.fare)}</Text>
                </Pressable>
              </MotiView>
            ))}
          </>
        )}
          </>
        )}
      </ScrollView>
      <SavedPlacesSheet
        visible={savedPlacesOpen}
        onSelect={(place) => {
          setSavedPlacesOpen(false);
          router.push({ pathname: '/plan', params: { saved: place.id } });
        }}
        onClose={() => setSavedPlacesOpen(false)}
      />
      <Modal
        transparent
        visible={mapsLinkOpen}
        animationType="fade"
        onRequestClose={() => setMapsLinkOpen(false)}
      >
        <View style={styles.mapsModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMapsLinkOpen(false)} />
          <View style={styles.mapsModalCard}>
            <View style={styles.mapsModalHeading}>
              <View style={styles.mapsModalIcon}>
                <Ionicons name="map-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.mapsModalTitleWrap}>
                <Text style={styles.mapsModalTitle}>Open a shared place</Text>
                <Text style={styles.mapsModalHint}>Paste a Google Maps place or pin link.</Text>
              </View>
              <Pressable onPress={() => setMapsLinkOpen(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <TextInput
              value={mapsLink}
              onChangeText={setMapsLink}
              placeholder="https://maps.app.goo.gl/..."
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              multiline
              style={styles.mapsLinkInput}
              accessibilityLabel="Google Maps link"
            />
            <Text style={styles.mapsModalHint}>
              The shared location opens as your destination. Choose a start point and route in Plan.
            </Text>
            <View style={styles.mapsModalActions}>
              <AnimatedButton
                label="Cancel"
                variant="ghost"
                onPress={() => setMapsLinkOpen(false)}
                style={{ flex: 1 }}
              />
              <AnimatedButton
                label="Open location"
                disabled={!mapsLink.trim()}
                onPress={() => {
                  const sharedUrl = mapsLink.trim();
                  setMapsLink('');
                  setMapsLinkOpen(false);
                  router.push({ pathname: '/plan', params: { mapsUrl: sharedUrl } });
                }}
                icon={<Ionicons name="arrow-forward" size={17} color={colors.onPrimary} />}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 110 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  savedPlacesSection: { gap: 8 },
  savedPlacesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 11,
  },
  savedPlacesIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedPlacesTitle: { color: colors.text, fontSize: 14, fontWeight: '700', fontFamily: fonts.bold },
  savedPlacesMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  savedChipPressed: { backgroundColor: colors.surfaceAlt },
  kicker: { color: colors.accent, letterSpacing: 3, fontSize: 11, fontWeight: '700', fontFamily: fonts.semibold },
  greeting: { color: colors.text, fontSize: 25, fontWeight: '800', marginTop: 4, letterSpacing: -0.5, fontFamily: fonts.extrabold },
  greetingName: { color: colors.primaryStrong, fontSize: 16, fontWeight: '700', marginTop: 2, fontFamily: fonts.bold },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent, fontWeight: '800', fontSize: 18, fontFamily: fonts.extrabold },

  actions: { flexDirection: 'row', gap: 10 },
  sharedMapWidget: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  sharedMapIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primarySoft },
  sharedMapCopy: { flex: 1, gap: 2 },
  sharedMapTitle: { color: colors.text, fontSize: 13, fontWeight: '700', fontFamily: fonts.bold },
  sharedMapHint: { color: colors.muted, fontSize: 11 },
  mapsModalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15, 23, 42, 0.42)' },
  mapsModalCard: { gap: 12, padding: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  mapsModalHeading: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  mapsModalIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primarySoft },
  mapsModalTitleWrap: { flex: 1, gap: 2 },
  mapsModalTitle: { color: colors.text, fontSize: 16, fontWeight: '800', fontFamily: fonts.bold },
  mapsModalHint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  mapsLinkInput: {
    minHeight: 82,
    maxHeight: 130,
    padding: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  mapsModalActions: { flexDirection: 'row', gap: 10, marginTop: 2 },
  action: { ...cardStyle, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', gap: 7 },
  actionPressed: { backgroundColor: colors.surfaceAlt },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: colors.text, fontSize: 11, fontWeight: '600', fontFamily: fonts.semibold },

  statsCard: { ...cardStyle, borderRadius: radius.lg, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: fonts.extrabold },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },

  section: { color: colors.text, fontWeight: '700', fontSize: 16, fontFamily: fonts.bold },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  showMore: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  showMoreText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 2 },
  periodSeg: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    padding: 3,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodPill: { paddingVertical: 6, paddingHorizontal: 18, borderRadius: 999 },
  periodPillOn: { backgroundColor: colors.primaryStrong },
  periodPillText: { color: colors.muted, fontWeight: '700', fontSize: 13, fontFamily: fonts.semibold },
  periodPillTextOn: { color: colors.onPrimary },
  weekArrow: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: { color: colors.text, fontWeight: '700', fontSize: 14, fontFamily: fonts.bold, minWidth: 130, textAlign: 'center' },
  emptyCard: { ...cardStyle, borderRadius: radius.md, padding: 20, alignItems: 'center', gap: 8 },
  empty: { color: colors.muted, lineHeight: 20, textAlign: 'center', fontSize: 13 },
  tripCard: { ...cardStyle, borderRadius: radius.md, padding: 14, gap: 12 },
  tripTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tripIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripName: { color: colors.text, fontWeight: '700', fontSize: 15, fontFamily: fonts.bold },
  tripMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeDone: { backgroundColor: '#D1FAE5' },
  badgeEnded: { backgroundColor: '#FFE4E6' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeTextDone: { color: '#065F46' },
  badgeTextEnded: { color: colors.danger },
  tripStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 10,
  },
  metric: { flex: 1, alignItems: 'flex-start', gap: 2 },
  metricValue: { color: colors.text, fontSize: 14, fontWeight: '800', fontFamily: fonts.extrabold },
  metricLabel: { color: colors.muted, fontSize: 11 },
  rideCard: { ...cardStyle, borderRadius: radius.md, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ridePressed: { backgroundColor: colors.surfaceAlt },
  rideIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rideFare: { color: colors.accent, fontWeight: '800', fontSize: 15, fontFamily: fonts.bold },
});
