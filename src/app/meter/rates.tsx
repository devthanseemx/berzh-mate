import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { TextField } from '../../components/TextField';
import { deleteRate, listRates, saveRate, type Rate } from '../../services/rates';
import { useMeter } from '../../store/meter';
import { colors, radius } from '../../theme/colors';
import { money } from '../../utils/fare';

type Form = { id?: string; name: string; price: string; base: string };

export default function Rates() {
  const activeRateId = useMeter((s) => s.activeRateId);
  const setActiveRateId = useMeter((s) => s.setActiveRateId);

  const [rates, setRates] = useState<Rate[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRates(await listRates());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const save = async () => {
    if (!form) return;
    const price = Number(form.price);
    const base = Number(form.base || 0);
    if (!form.name.trim()) return setError('Enter a name, such as Tuk-Tuk.');
    if (!(price > 0)) return setError('Enter a price per kilometre greater than 0.');
    if (!(base >= 0)) return setError('Base fare cannot be negative.');

    setBusy(true);
    setError(null);
    try {
      await saveRate({ id: form.id, name: form.name, price_per_km: price, base_fare: base });
      setForm(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = (r: Rate) =>
    Alert.alert('Delete rate?', `"${r.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRate(r.id);
            if (activeRateId === r.id) setActiveRateId(null);
            await load();
          } catch (e: any) {
            setError(e.message);
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>Tap a rate to use it for the next trip.</Text>

        {rates.map((r) => {
          const active = r.id === activeRateId;
          return (
            <View key={r.id} style={[styles.card, active && styles.cardActive]}>
              <Pressable onPress={() => setActiveRateId(r.id)} style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {active ? '✓ ' : ''}
                  {r.name}
                </Text>
                <Text style={styles.meta}>
                  {money(r.price_per_km)} per km
                  {r.base_fare > 0 ? ` · base ${money(r.base_fare)}` : ''}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <Pressable onPress={() => setForm({ id: r.id, name: r.name, price: String(r.price_per_km), base: String(r.base_fare) })}>
                  <Text style={styles.link}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => remove(r)}>
                  <Text style={[styles.link, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {rates.length === 0 && <Text style={styles.hint}>No rates yet. Add one below.</Text>}

        {form ? (
          <View style={styles.form}>
            <Text style={styles.formTitle}>{form.id ? 'Edit rate' : 'New rate'}</Text>
            <TextField label="Name" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} placeholder="Tuk-Tuk" />
            <TextField label="Price per kilometre (LKR)" value={form.price} onChangeText={(v) => setForm({ ...form, price: v })} keyboard="decimal-pad" placeholder="e.g. 100" />
            <TextField label="Base fare (optional, LKR)" value={form.base} onChangeText={(v) => setForm({ ...form, base: v })} keyboard="decimal-pad" placeholder="0" />
            {error && <Text style={styles.error}>{error}</Text>}
            <AnimatedButton label={busy ? 'Saving…' : 'Save rate'} disabled={busy} onPress={save} style={{ marginTop: 16 }} />
            <AnimatedButton label="Cancel" variant="ghost" onPress={() => { setForm(null); setError(null); }} style={{ marginTop: 10 }} />
          </View>
        ) : (
          <>
            {error && <Text style={styles.error}>{error}</Text>}
            <AnimatedButton label="Add new rate" onPress={() => setForm({ name: '', price: '', base: '' })} style={{ marginTop: 10 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 10 },
  hint: { color: colors.muted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActive: { borderColor: colors.accent },
  name: { color: colors.text, fontWeight: '700', fontSize: 16 },
  meta: { color: colors.muted, marginTop: 4 },
  actions: { gap: 10, marginLeft: 12 },
  link: { color: colors.primary, fontWeight: '600' },
  form: {
    marginTop: 12,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  formTitle: { color: colors.text, fontWeight: '800', fontSize: 18 },
  error: { color: colors.danger, marginTop: 10 },
});