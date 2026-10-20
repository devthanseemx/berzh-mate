import { MotiView } from 'moti';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DAILY_LIMIT, useUsage, usedFor } from '../store/usage';
import { cardStyle, colors, radius } from '../theme/colors';

// Shows today's credit use. Pass onPress to open the Usage screen.
export function CreditBar({ onPress }: { onPress?: () => void }) {
  const day = useUsage((s) => s.day);
  const used = useUsage((s) => s.used);
  const events = useUsage((s) => s.events);

  const todayUsed = usedFor({ day, used });
  const pct = Math.min(1, todayUsed / DAILY_LIMIT);
  const left = Math.max(0, DAILY_LIMIT - todayUsed);
  const color = pct >= 1 ? colors.danger : pct >= 0.8 ? colors.warn : colors.accent;
  const lastError = events.find((e) => e.kind === 'error');

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <MotiView
        from={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 350 }}
        style={styles.card}
      >
        <View style={styles.row}>
          <Text style={styles.title}>Search and route credits today</Text>
          <Text style={[styles.count, { color }]}>
            {todayUsed} / {DAILY_LIMIT}
          </Text>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>

        <Text style={styles.sub}>
          {pct >= 1
            ? 'Used up. Searches and routes resume after midnight.'
            : pct >= 0.8
            ? `Running low. ${left} left today.`
            : `${left} left today. Counted by this app.`}
        </Text>

        {lastError && (
          <Text style={styles.issue} numberOfLines={2}>
            Last issue: {lastError.message}
          </Text>
        )}
      </MotiView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: 16,
    gap: 8,
    ...cardStyle,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontWeight: '700' },
  count: { fontWeight: '800', fontSize: 15 },
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 5 },
  sub: { color: colors.muted, fontSize: 12 },
  issue: { color: colors.danger, fontSize: 12 },
});
