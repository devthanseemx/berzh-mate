import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import type { TripRow } from '../services/history';
import { cardStyle, colors, radius } from '../theme/colors';
import { fonts } from '../theme/font';
import { formatDistance } from '../utils/format';
import type { ChartPeriod } from './SpendingChart';

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LETTERS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Bucket = { key: string; label: string; distanceKm: number; isNow: boolean };

function buildDistanceBuckets(period: ChartPeriod, start: Date, end: Date, trips: TripRow[]): Bucket[] {
  const buckets: Bucket[] = [];
  const today = new Date();
  const todayKey = today.toDateString();

  if (period === 'week' || period === 'month') {
    for (const date = new Date(start); date < end; date.setDate(date.getDate() + 1)) {
      const day = date.getDate();
      buckets.push({
        key: date.toDateString(),
        label: period === 'week' ? DAY_LETTERS[date.getDay()] : day === 1 || day % 7 === 1 ? String(day) : '',
        distanceKm: 0,
        isNow: date.toDateString() === todayKey,
      });
    }
  } else {
    for (let month = 0; month < 12; month++) {
      buckets.push({
        key: `${start.getFullYear()}-${month}`,
        label: MONTH_LETTERS[month],
        distanceKm: 0,
        isNow: start.getFullYear() === today.getFullYear() && month === today.getMonth(),
      });
    }
  }

  for (const trip of trips) {
    if (trip.planned_distance_m == null) continue;
    const date = new Date(trip.finished_at);
    const key = period === 'year' ? `${date.getFullYear()}-${date.getMonth()}` : date.toDateString();
    const bucket = buckets.find((item) => item.key === key);
    if (bucket) bucket.distanceKm += Math.max(0, trip.planned_distance_m) / 1000;
  }
  return buckets;
}

export function DistanceChart({
  period,
  start,
  end,
  trips,
}: {
  period: ChartPeriod;
  start: Date;
  end: Date;
  trips: TripRow[];
}) {
  const { width } = useWindowDimensions();
  const buckets = useMemo(
    () => buildDistanceBuckets(period, start, end, trips),
    [period, start, end, trips]
  );
  const totalKm = buckets.reduce((sum, bucket) => sum + bucket.distanceKm, 0);
  const data = buckets.map((bucket) => ({
    value: bucket.distanceKm,
    label: bucket.label,
    frontColor: bucket.isNow ? colors.accent : colors.primaryStrong,
  }));
  const chartWidth = Math.max(160, width - 68);
  const barWidth = period === 'month' ? 5 : period === 'year' ? 14 : 22;
  const spacing = Math.max(
    3,
    Math.min(24, (chartWidth - buckets.length * barWidth - 8) / Math.max(1, buckets.length - 1))
  );
  const rangeLabel =
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
          <Text style={styles.title}>Trip distance</Text>
          <Text style={styles.sub}>Recorded route distance · {rangeLabel}</Text>
        </View>
        <View style={styles.totalBox}>
          <Text style={styles.total}>{formatDistance(totalKm * 1000)}</Text>
          <Text style={styles.sub}>{trips.length} {trips.length === 1 ? 'trip' : 'trips'}</Text>
        </View>
      </View>
      <View style={styles.chartBox}>
        <BarChart
          data={data}
          width={chartWidth}
          height={132}
          barWidth={barWidth}
          spacing={spacing}
          initialSpacing={4}
          endSpacing={4}
          noOfSections={4}
          maxValue={Math.max(1, ...buckets.map((bucket) => bucket.distanceKm)) * 1.2}
          isAnimated
          hideRules
          hideYAxisText
          yAxisThickness={0}
          xAxisThickness={0}
          yAxisColor="transparent"
          xAxisColor={colors.border}
          xAxisLabelTextStyle={styles.axisLabel}
          barBorderTopLeftRadius={4}
          barBorderTopRightRadius={4}
        />
      </View>
      {totalKm === 0 && <Text style={styles.empty}>No route distance recorded for this period yet.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 18, ...cardStyle },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: colors.text, fontWeight: '800', fontSize: 16, fontFamily: fonts.bold },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  totalBox: { alignItems: 'flex-end' },
  total: { color: colors.accent, fontWeight: '800', fontSize: 21, fontFamily: fonts.extrabold },
  chartBox: { marginTop: 12, height: 172, justifyContent: 'flex-start' },
  axisLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  empty: { color: colors.muted, fontSize: 12, marginTop: 8, textAlign: 'center' },
});
