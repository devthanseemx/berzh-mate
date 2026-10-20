import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { BackButton } from '../components/BackButton';
import { CreditBar } from '../components/CreditBar';
import { useConfirm } from '../components/Confirm';
import { TextField } from '../components/TextField';
import { useToast } from '../components/Toast';
import { DAILY_LIMIT, useUsage } from '../store/usage';
import { cardStyle, colors, radius } from '../theme/colors';
import { formatClock } from '../utils/format';

export default function Usage() {
  const events = useUsage((s) => s.events);
  const setUsed = useUsage((s) => s.setUsed);
  const clearLog = useUsage((s) => s.clearLog);
  const [calib, setCalib] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const apply = () => {
    const n = Number(calib);
    if (!Number.isFinite(n) || n < 0 || n > DAILY_LIMIT) {
      setNote(`Enter a number between 0 and ${DAILY_LIMIT}.`);
      return;
    }
    setUsed(n);
    setCalib('');
    setNote(null);
    toast.success('Updated', 'Count matches the dashboard.');
  };

  const confirmClear = async () => {
    const ok = await confirm({
      title: 'Clear the service log?',
      message: 'Recorded search and route issues will be removed from this list.',
      confirmLabel: 'Clear',
      danger: true,
    });
    if (!ok) return;
    clearLog();
    toast.info('Cleared', 'Service log is empty.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.content}>
        <CreditBar />

        <View style={styles.card}>
          <Text style={styles.section}>Match the Geoapify dashboard</Text>
          <Text style={styles.hint}>
            This app counts the credits it uses, which can differ slightly from the dashboard. Check the
            used credits on the Geoapify dashboard, then enter that number here.
          </Text>
          <TextField
            label="Credits used today (from dashboard)"
            value={calib}
            onChangeText={setCalib}
            keyboard="decimal-pad"
            placeholder="e.g. 420"
          />
          {note && <Text style={styles.note}>{note}</Text>}
          <AnimatedButton label="Update count" onPress={apply} style={{ marginTop: 12 }} />
        </View>

        <View style={styles.card}>
          <View style={styles.logHead}>
            <Text style={styles.section}>Service log</Text>
            {events.length > 0 && (
              <Text style={styles.clear} onPress={confirmClear}>
                Clear
              </Text>
            )}
          </View>
          {events.length === 0 && <Text style={styles.hint}>No problems recorded. Failed searches and routes appear here.</Text>}
          {events.map((e) => (
            <View key={`${e.t}-${e.message}`} style={styles.logRow}>
              <Text style={styles.logTime}>
                {new Date(e.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {formatClock(e.t)}
              </Text>
              <Text style={[styles.logText, e.kind === 'error' && { color: colors.danger }]}>{e.message}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 64, gap: 14 },
  card: {
    borderRadius: radius.lg,
    padding: 16,
    ...cardStyle,
  },
  section: { color: colors.text, fontWeight: '700', fontSize: 15 },
  hint: { color: colors.muted, marginTop: 6, fontSize: 12, lineHeight: 17 },
  note: { color: colors.accent, marginTop: 10, fontSize: 12 },
  logHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clear: { color: colors.accent, fontWeight: '600' },
  logRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border },
  logTime: { color: colors.muted, fontSize: 11 },
  logText: { color: colors.text, marginTop: 2, fontSize: 13 },
});