import { StyleSheet, View } from 'react-native';
import { radius } from '../theme/colors';
import { Skeleton } from './Skeleton';

// Home placeholder: mirrors the real layout (header, quick actions, stats,
// chart, trips) so the screen never shows an empty flash while data loads.
export function HomeSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Skeleton width={90} height={12} round={6} />
          <Skeleton width={210} height={26} round={8} />
        </View>
        <Skeleton width={46} height={46} round={23} />
      </View>

      <View style={styles.actions}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={84} round={radius.md} style={{ flex: 1 }} />
        ))}
      </View>

      <Skeleton height={76} round={radius.lg} />
      <Skeleton height={224} round={radius.lg} />
      <Skeleton width={130} height={18} round={8} />
      <Skeleton height={104} round={radius.lg} />
      <Skeleton height={104} round={radius.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1, gap: 8 },
  actions: { flexDirection: 'row', gap: 10 },
});
