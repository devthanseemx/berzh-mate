import { router } from 'expo-router';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { saveFareTrip } from '../../services/fares';
import { requestNavigationPermissions } from '../../services/location';
import { startMeterTracking, stopMeterTracking } from '../../services/meterLocation';
import { listRates, type Rate } from '../../services/rates';
import { useMeter } from '../../store/meter';
import { useSettings } from '../../store/settings';
import { colors, radius } from '../../theme/colors';
import { fareFor, money } from '../../utils/fare';
import { formatDistance } from '../../utils/format';

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

  // Refresh the display every second while a trip is running.
  useEffect(() => {
    if (run.status !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [run.status]);

  const endMs = run.status === 'done' ? run.endedAt ?? now : now;
  const elapsedS = run.startedAt ? Math.max(0, (endMs - run.startedAt) / 1000) : 0;
  const fare = run.rate ? fareFor(run.distanceM, run.rate.pricePerKm, run.rate.baseFare) : 0;

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
    } catch (e: any) {
      setSaveError(`Trip not saved: ${e.message}`);
    }
  };

  const doneFare = run.rate ? fareFor(run.distanceM, run.rate.pricePerKm, run.rate.baseFare) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
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

        <MotiView
          key={run.status}
          from={{ opacity: 0.5, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 250 }}
          style={styles.fareCard}
        >
          <Text style={styles.fareLabel}>{run.status === 'done' ? 'TOTAL FARE' : 'FARE'}</Text>
          <Text style={styles.fare} numberOfLines={1} adjustsFontSizeToFit>
            {money(run.status === 'done' ? doneFare : fare)}
          </Text>
        </MotiView>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>{formatDistance(run.distanceM)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>{clock(elapsedS)}</Text>
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
            <SummaryRow label="Rate" value={run.rate?.name ?? '—'} />
            <SummaryRow label="Total fare" value={money(doneFare)} strong />
            <Text style={styles.hint}>
              {saveHistory && !saveError ? 'Saved to your trip history.' : saveHistory ? '' : 'Not saved (history is off in Settings).'}
            </Text>
            {saveError && <Text style={styles.error}>{saveError}</Text>}
            <AnimatedButton label="New trip" onPress={reset} style={{ marginTop: 14 }} />
          </MotiView>
        )}

        <View style={styles.links}>
          <AnimatedButton label="Plan a fare" variant="ghost" onPress={() => router.push('/meter/estimate')} style={{ flex: 1 }} />
          <AnimatedButton label="History" variant="ghost" onPress={() => router.push('/meter/history')} style={{ flex: 1 }} />
        </View>
        <AnimatedButton label="Rates" variant="ghost" onPress={() => router.push('/meter/rates')} style={{ marginTop: 10 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, strong && { color: colors.accent, fontSize: 18 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 8 },
  kicker: { color: colors.accent, letterSpacing: 3, fontWeight: '700', fontSize: 12 },
  rateName: { color: colors.text, fontSize: 24, fontWeight: '800' },
  rateMeta: { color: colors.muted },
  fareCard: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 22,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
  },
  fareLabel: { color: colors.muted, letterSpacing: 2, fontSize: 12, fontWeight: '700' },
  fare: { color: colors.accent, fontSize: 44, fontWeight: '800', marginTop: 4 },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: { color: colors.muted, fontSize: 12 },
  statValue: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 4 },
  summary: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 10,
  },
  summaryTitle: { color: colors.text, fontWeight: '800', fontSize: 18 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: colors.muted },
  summaryValue: { color: colors.text, fontWeight: '700' },
  links: { flexDirection: 'row', gap: 10, marginTop: 22 },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger },
});