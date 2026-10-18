import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { CreditBar } from '../components/CreditBar';
import { TextField } from '../components/TextField';
import { DAILY_LIMIT, useUsage } from '../store/usage';
import { colors, radius } from '../theme/colors';
import { formatClock } from '../utils/format';

export default function Usage() {
  const events = useUsage((s) => s.events);
  const setUsed = useUsage((s) => s.setUsed);
  const clearLog = useUsage((s) => s.clearLog);
  const [calib, setCalib] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const apply = () => {
    const n = Number(calib);
    if (!Number.isFinite(n) || n < 0 || n > DAILY_LIMIT) {
      setNote(`Enter a number between 0 and ${DAILY_LIMIT}.`);
      return;
    }
    setUsed(n);
    setCalib('');
    setNote('Updated to match the dashboard.');
  };

  return (
    <SafeAreaView style={styles.safe}>
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
              <Text style={styles.clear} onPress={clearLog}>
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
  content: { padding: 20, gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { color: colors.text, fontWeight: '700', fontSize: 15 },
  hint: { color: colors.muted, marginTop: 6, fontSize: 12, lineHeight: 17 },
  note: { color: colors.primary, marginTop: 10, fontSize: 12 },
  logHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clear: { color: colors.primary, fontWeight: '600' },
  logRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: colors.border },
  logTime: { color: colors.muted, fontSize: 11 },
  logText: { color: colors.text, marginTop: 2, fontSize: 13 },
});