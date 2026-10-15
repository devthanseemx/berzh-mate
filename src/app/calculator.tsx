import { MotiView } from 'moti';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTripStore } from '../store/tripStore';
import { colors, radius } from '../theme/colors';

export default function Calculator() {
  const routeKm = useTripStore((s) => (s.route ? s.route.distanceM / 1000 : null));
  const [distance, setDistance] = useState(routeKm ? routeKm.toFixed(1) : '');
  const [efficiency, setEfficiency] = useState('12');  // km per liter
  const [price, setPrice] = useState('');              // fuel price per liter
  const [tolls, setTolls] = useState('0');
  const [people, setPeople] = useState('1');

  const n = (v: string) => parseFloat(v) || 0;
  const fuelCost = efficiency && n(efficiency) > 0 ? (n(distance) / n(efficiency)) * n(price) : 0;
  const total = fuelCost + n(tolls);
  const perPerson = n(people) > 0 ? total / n(people) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Distance (km)" value={distance} onChange={setDistance} />
        <Field label="Fuel efficiency (km per liter)" value={efficiency} onChange={setEfficiency} />
        <Field label="Fuel price per liter" value={price} onChange={setPrice} />
        <Field label="Tolls / extra costs" value={tolls} onChange={setTolls} />
        <Field label="Passengers" value={people} onChange={setPeople} />

        <MotiView
          key={perPerson.toFixed(2)}
          from={{ opacity: 0.4, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 300 }}
          style={styles.result}
        >
          <Text style={styles.kicker}>COST PER PERSON</Text>
          <Text style={styles.big}>{perPerson.toFixed(2)}</Text>
          <View style={styles.breakdown}>
            <Text style={styles.muted}>Fuel: {fuelCost.toFixed(2)}</Text>
            <Text style={styles.muted}>Total: {total.toFixed(2)}</Text>
          </View>
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 14 },
  field: { gap: 6 },
  label: { color: colors.muted, fontSize: 13 },
  input: { backgroundColor: colors.surface, color: colors.text, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border, fontSize: 16 },
  result: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, padding: 22, marginTop: 10, borderWidth: 1, borderColor: colors.primary },
  kicker: { color: colors.primary, letterSpacing: 2, fontSize: 11, fontWeight: '700' },
  big: { color: colors.accent, fontSize: 40, fontWeight: '800', marginTop: 6 },
  breakdown: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  muted: { color: colors.muted },
});