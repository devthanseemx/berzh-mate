import { MotiView } from 'moti';
import { StyleSheet, Text } from 'react-native';
import { haversine } from '../services/geo';
import { useTripStore } from '../store/tripStore';
import { colors, radius } from '../theme/colors';
import { formatDistance } from '../utils/format';

// Distances under 1 km show in meters, which is easier to read for turns.
function shortDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : formatDistance(m);
}

export function NextTurn() {
  const navigating = useTripStore((s) => s.navigating);
  const position = useTripStore((s) => s.position);
  const route = useTripStore((s) => s.route);
  const stepIndex = useTripStore((s) => s.stepIndex);

  const steps = route?.steps ?? [];
  const step = steps[stepIndex];
  const after = steps[stepIndex + 1];

  if (!navigating || !step || !position) return null;

  const d = haversine(position, step.coord);

  return (
    <MotiView
      key={stepIndex}
      from={{ opacity: 0, translateY: -10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 250 }}
      style={styles.card}
    >
      <Text style={styles.distance}>{shortDistance(d)}</Text>
      <Text style={styles.text}>{step.text}</Text>
      {after && (
        <Text style={styles.then} numberOfLines={1}>
          Then: {after.text}
        </Text>
      )}
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.routeActive,
  },
  distance: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  text: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 2 },
  then: { color: colors.muted, marginTop: 6, fontSize: 13 },
});