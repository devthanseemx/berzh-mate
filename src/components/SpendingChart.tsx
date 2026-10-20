import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { listFareTrips, type FareTripRow } from '../services/fares';
import { cardStyle, colors, radius } from '../theme/colors';
import { fonts } from '../theme/font';
import { money } from '../utils/fare';

export type ChartPeriod = 'week' | 'month' | 'year';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // indexed by Date.getDay()
const MONTH_LETTERS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Bucket = { key: string; label: string; total: number; isNow: boolean };

// Splits the selected range into chart buckets (7 days, the days of a month,
// or 12 months) and sums each bucket's meter fares.
function buildBuckets(period: ChartPeriod, start: Date, end: Date, trips: FareTripRow[]): Bucket[] {
  const buckets: Bucket[] = [];
  const todayKey = new Date().toDateString();
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();

  if (period === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      buckets.push({
        key: d.toDateString(),
        label: DAY_LETTERS[d.getDay()],
        total: 0,
        isNow: d.toDateString() === todayKey,
      });
    }
  } else if (period === 'month') {
    const days = Math.round((end.getTime() - start.getTime()) / 86400000);
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const day = d.getDate();
      buckets.push({
        key: d.toDateString(),
        // Sparse labels (1, 8, 15, 22, 29) so 30 points stay readable.
        label: day === 1 || day % 7 === 1 ? String(day) : '',
        total: 0,
        isNow: d.toDateString() === todayKey,
      });
    }
  } else {
    for (let m = 0; m < 12; m++) {
      buckets.push({
        key: `${start.getFullYear()}-${m}`,
        label: MONTH_LETTERS[m],
        total: 0,
        isNow: start.getFullYear() === thisYear && m === thisMonth,
      });
    }
  }

  for (const t of trips) {
    const d = new Date(t.ended_at);
    const key =
      period === 'year' ? `${d.getFullYear()}-${d.getMonth()}` : d.toDateString();
    const bucket = buckets.find((b) => b.key === key);
    if (bucket) bucket.total += Number(t.fare) || 0;
  }
  return buckets;
}

// Home card: line chart of meter-trip spending for the selected week,
// month, or year, rendered with react-native-gifted-charts.
export function SpendingChart({ period, start, end }: { period: ChartPeriod; start: Date; end: Date }) {
  const [trips, setTrips] = useState<FareTripRow[]>([]);
  const { width } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      let live = true;
      listFareTrips()
        .then((t) => {
          if (live) setTrips(t);
        })
        .catch(() => {
          // Keep whatever was loaded before.
        });
      return () => {
        live = false;
      };
    }, [])
  );

  const buckets = useMemo(() => buildBuckets(period, start, end, trips), [period, start, end, trips]);
  const total = buckets.reduce((sum, b) => sum + b.total, 0);
  const tripCount = trips.filter((t) => {
    const d = new Date(t.ended_at);
    return d >= start && d < end;
  }).length;
  const max = Math.max(1, ...buckets.map((b) => b.total));

  const chartData = useMemo(
    () =>
      buckets.map((b) => ({
        value: b.total,
        label: b.label,
        dataPointColor: b.isNow ? colors.danger : colors.primaryStrong,
      })),
    [buckets]
  );

  // Screen padding (16 x2) + card padding (18 x2).
  const chartWidth = Math.max(160, width - 68);
  // Fit every point inside the visible width — the library's default spacing
  // (50px) overflows for month/year buckets and clips most of the chart.
  const spacing = Math.max(3, (chartWidth - 8) / Math.max(1, buckets.length - 1));

  const rangeText =
    period === 'week'
      ? `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(
          end.getTime() - 86400000
        ).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : period === 'month'
        ? start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : String(start.getFullYear());

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View>
          <Text style={styles.title}>Spending</Text>
          <Text style={styles.sub}>Meter trips · {rangeText}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.total}>{money(total)}</Text>
          <Text style={styles.sub}>
            {tripCount} {tripCount === 1 ? 'trip' : 'trips'}
          </Text>
        </View>
      </View>

      <View style={styles.chartBox}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={132}
          curved
          areaChart
          color={colors.primaryStrong}
          thickness={3}
          startFillColor={colors.primary}
          endFillColor={colors.primary}
          startOpacity={0.3}
          endOpacity={0.02}
          dataPointsRadius={3.5}
          initialSpacing={4}
          endSpacing={4}
          spacing={spacing}
          hideDataPoints={total === 0}
          isAnimated
          animateOnDataChange
          disableScroll
          hideRules
          hideYAxisText
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisColor="transparent"
          xAxisColor={colors.border}
          maxValue={Math.max(max * 1.2, 100)}
          noOfSections={4}
          xAxisLabelTextStyle={styles.axisLabel}
        />
      </View>

      {total === 0 && (
        <Text style={styles.empty}>
          No meter spending this {period === 'week' ? 'week' : period === 'month' ? 'month' : 'year'} yet.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: 18,
    ...cardStyle,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: colors.text, fontWeight: '800', fontSize: 16, fontFamily: fonts.bold },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  totalBox: { alignItems: 'flex-end' },
  total: { color: colors.accent, fontWeight: '800', fontSize: 22, fontFamily: fonts.extrabold },
  // Fixed box height so the card never jumps between loads; leaves room
  // below the plot for the day labels so nothing gets clipped.
  chartBox: { marginTop: 12, height: 172, justifyContent: 'flex-start' },
  axisLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  empty: { color: colors.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },
});
