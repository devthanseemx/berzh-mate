import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { useToast } from '../../components/Toast';
import { saveFareTrip } from '../../services/fares';
import { requestNavigationPermissions } from '../../services/location';
import { startMeterTracking, stopMeterTracking } from '../../services/meterLocation';
import { listRates, type Rate } from '../../services/rates';
import { useMeter } from '../../store/meter';
import { useSettings } from '../../store/settings';
import { cardStyle, colors, radius } from '../../theme/colors';
import { fonts } from '../../theme/font';
import { fareFor, money } from '../../utils/fare';
import { formatDistance } from '../../utils/format';

// A finished summary older than this is cleared when the screen opens —
// the trip itself stays in History.
const STALE_DONE_MS = 15 * 60 * 1000;

// Time as m:ss, or h:mm:ss after an hour.
function clock(totalSeconds: number): string {
  const t = Math.floor(totalSeconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

export default function MeterScreen() {
  const run = useMeter((s) => s.run);
  const activeRateId = useMeter((s) => s.activeRateId);
  const startTrip = useMeter((s) => s.startTrip);
  const stopTrip = useMeter((s) => s.stopTrip);
  const reset = useMeter((s) => s.reset);
  const saveHistory = useSettings((s) => s.saveHistory);
  const toast = useToast();

  const [rates, setRates] = useState<Rate[]>([]);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const activeRate = rates.find((r) => r.id === activeRateId) ?? null;

  useEffect(() => {
    listRates().then(setRates).catch(() => {});
  }, []);

  // If the app was closed during a trip, resume tracking.
  useEffect(() => {
    if (run.status === 'running') startMeterTracking().catch(() => {});
  }, []);

  // Don't show yesterday's finished summary forever — clear it after 15 minutes.
  // (reset is a stable zustand action, so this runs once on mount.)
  useEffect(() => {
    if (run.status === 'done' && run.endedAt && Date.now() - run.endedAt > STALE_DONE_MS) reset();
  }, [reset, run.status, run.endedAt]);

  // Refresh the display every second while a trip is running.
  useEffect(() => {
    if (run.status !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [run.status]);

  const endMs = run.status === 'done' ? run.endedAt ?? now : now;
  const elapsedS = run.startedAt ? Math.max(0, (endMs - run.startedAt) / 1000) : 0;
  const fare = run.rate ? fareFor(run.distanceM, run.rate.pricePerKm, run.rate.baseFare) : 0;
  // Average speed over the trip, in km/h — from distance and time already tracked.
  const speedKmh = elapsedS > 1 ? run.distanceM / 1000 / (elapsedS / 3600) : 0;

  const start = async () => {
    if (!activeRate) {
      Alert.alert('Choose a rate', 'Pick a rate profile first.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rates', onPress: () => router.push('/meter/rates') },
      ]);
      return;
    }
    const ok = await requestNavigationPermissions();
    if (!ok) {
      Alert.alert('Location needed', 'Allow location to measure the trip.');
      return;
    }
    setSaveError(null);
    startTrip({ name: activeRate.name, pricePerKm: activeRate.price_per_km, baseFare: activeRate.base_fare });
    await startMeterTracking();
  };

  const stop = async () => {
    setBusy(true);
    await stopMeterTracking();
    const done = stopTrip();
    setBusy(false);

    if (!done?.rate || !done.startedAt || !done.endedAt || !saveHistory) return;
    try {
      await saveFareTrip({
        rate: done.rate,
        distanceM: done.distanceM,
        durationS: (done.endedAt - done.startedAt) / 1000,
        fare: fareFor(done.distanceM, done.rate.pricePerKm, done.rate.baseFare),
        startedAt: done.startedAt,
        endedAt: done.endedAt,
        path: done.path,
      });
      toast.success('Trip completed', 'Saved to your history.');
    } catch (e: any) {
      setSaveError(`Trip not saved: ${e.message}`);
      toast.error('Not saved', `Trip could not be saved: ${e.message}`);
    }
  };

  const doneFare = run.rate ? fareFor(run.distanceM, run.rate.pricePerKm, run.rate.baseFare) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>BERZH METER</Text>
        <Text style={styles.rateName}>{run.rate?.name ?? activeRate?.name ?? 'No rate selected'}</Text>
        {(run.rate || activeRate) && (
          <Text style={styles.rateMeta}>
            {money(run.rate?.pricePerKm ?? activeRate!.price_per_km)} per km
            {(run.rate?.baseFare ?? activeRate?.base_fare ?? 0) > 0
              ? ` · base ${money(run.rate?.baseFare ?? activeRate!.base_fare)}`
              : ''}
          </Text>
        )}

        {/* Hero fare */}
        <MotiView
          key={run.status}
          from={{ opacity: 0.5, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 250 }}
          style={styles.fareCard}
        >
          <Text style={styles.fareLabel}>{run.status === 'done' ? 'TOTAL FARE' : 'FARE'}</Text>
          <Text style={styles.fare} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
            {money(run.status === 'done' ? doneFare : fare)}
          </Text>
          {run.status === 'running' && (
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Meter running</Text>
            </View>
          )}
        </MotiView>

        {/* Stat grid — big tiles for the values you watch while driving */}
        <View style={styles.grid}>
          <View style={[styles.tile, styles.tileBig]}>
            <Text style={styles.tileValue}>{formatDistance(run.distanceM)}</Text>
            <Text style={styles.tileLabel}>Distance</Text>
          </View>
          <View style={[styles.tile, styles.tileBig]}>
            <Text style={[styles.tileValue, { color: colors.accent }]}>{speedKmh.toFixed(1)}</Text>
            <Text style={styles.tileLabel}>km/h average</Text>
          </View>
        </View>
        <View style={styles.grid}>
          <View style={styles.tile}>
            <Text style={styles.tileValueSmall}>{clock(elapsedS)}</Text>
            <Text style={styles.tileLabel}>Time</Text>
          </View>
          <View style={styles.tile}>
            <Text style={styles.tileValueSmall} numberOfLines={1}>{run.status === 'running' ? 'Running' : run.status === 'done' ? 'Finished' : 'Idle'}</Text>
            <Text style={styles.tileLabel}>Status</Text>
          </View>
        </View>

        {run.status === 'idle' && (
          <AnimatedButton label="Start trip" onPress={start} disabled={!activeRate} style={{ marginTop: 18 }} />
        )}

        {run.status === 'running' && (
          <AnimatedButton label={busy ? 'Ending…' : 'End trip'} variant="danger" disabled={busy} onPress={stop} style={{ marginTop: 18 }} />
        )}

        {run.status === 'done' && (
          <MotiView from={{ opacity: 0, translateY: 12 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 350 }} style={styles.summary}>
            <Text style={styles.summaryTitle}>Trip summary</Text>
            <SummaryRow label="Distance" value={formatDistance(run.distanceM)} />
            <SummaryRow label="Duration" value={clock(elapsedS)} />
            <SummaryRow label="Average speed" value={`${speedKmh.toFixed(1)} km/h`} />
            <SummaryRow label="Rate" value={run.rate?.name ?? '—'} />
            <SummaryRow label="Total fare" value={money(doneFare)} strong />
            <Text style={styles.hint}>
              {saveHistory && !saveError ? 'Saved to your trip history.' : saveHistory ? '' : 'Not saved (history is off in Settings).'}
            </Text>
            {saveError && <Text style={styles.error}>{saveError}</Text>}
            <AnimatedButton label="New trip" onPress={reset} style={{ marginTop: 14 }} />
          </MotiView>
        )}

        {/* Quick links as compact icon tiles */}
        <View style={styles.linkRow}>
          <LinkTile icon="calculator-outline" label="Estimate" onPress={() => router.push('/meter/estimate')} />
          <LinkTile icon="time-outline" label="History" onPress={() => router.push('/meter/history')} />
          <LinkTile icon="pricetags-outline" label="Rates" onPress={() => router.push('/meter/rates')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function LinkTile({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkTile, pressed && styles.linkTilePressed]}>
      <Ionicons name={icon} size={20} color={colors.accent} />
      <Text style={styles.linkLabel}>{label}</Text>
    </Pressable>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 10, paddingBottom: 110 },
  kicker: { color: colors.accent, letterSpacing: 3, fontWeight: '700', fontSize: 12, fontFamily: fonts.semibold },
  rateName: { color: colors.text, fontSize: 26, fontWeight: '800', fontFamily: fonts.extrabold, letterSpacing: -0.4 },
  rateMeta: { color: colors.muted },
  fareCard: {
    marginTop: 14,
    ...cardStyle,
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
  },
  fareLabel: { color: colors.muted, letterSpacing: 2, fontSize: 12, fontWeight: '700' },
  fare: { color: colors.accent, fontSize: 48, fontWeight: '800', marginTop: 4, fontFamily: fonts.extrabold },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  tile: {
    flex: 1,
    ...cardStyle,
    borderRadius: radius.md,
    padding: 14,
    gap: 3,
  },
  tileBig: { padding: 18 },
  tileValue: { color: colors.text, fontSize: 28, fontWeight: '800', fontFamily: fonts.extrabold, letterSpacing: -0.5 },
  tileValueSmall: { color: colors.text, fontSize: 18, fontWeight: '800', fontFamily: fonts.bold },
  tileLabel: { color: colors.muted, fontSize: 12 },
  summary: {
    marginTop: 18,
    ...cardStyle,
    borderRadius: radius.lg,
    padding: 18,
    gap: 10,
  },
  summaryTitle: { color: colors.text, fontWeight: '800', fontSize: 18, fontFamily: fonts.bold },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: colors.muted },
  summaryValue: { color: colors.text, fontWeight: '700' },
  summaryStrong: { color: colors.accent, fontSize: 18, fontFamily: fonts.extrabold },
  linkRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  linkTile: {
    flex: 1,
    ...cardStyle,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  linkTilePressed: { backgroundColor: colors.surfaceAlt },
  linkLabel: { color: colors.text, fontSize: 11, fontWeight: '600', fontFamily: fonts.semibold },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger },
});
