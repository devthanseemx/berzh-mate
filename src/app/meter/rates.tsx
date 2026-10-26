import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { BackButton } from '../../components/BackButton';
import { useConfirm } from '../../components/Confirm';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import { deleteRate, listRates, saveRate, type Rate } from '../../services/rates';
import { useMeter } from '../../store/meter';
import { cardStyle, colors, radius } from '../../theme/colors';
import { money } from '../../utils/fare';

type Form = { id?: string; name: string; price: string; base: string };

export default function Rates() {
  const activeRateId = useMeter((s) => s.activeRateId);
  const setActiveRateId = useMeter((s) => s.setActiveRateId);
  const confirm = useConfirm();
  const toast = useToast();

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
      toast.success('Saved', 'Rate is ready for trips.');
      await load();
    } catch (e: any) {
      setError(e.message);
      toast.error('Could not save', e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (r: Rate) => {
    const ok = await confirm({
      title: 'Delete rate?',
      message: `“${r.name}” will be removed.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRate(r.id);
      if (activeRateId === r.id) setActiveRateId(null);
      toast.success('Deleted', 'Rate removed.');
      await load();
    } catch (e: any) {
      setError(e.message);
      toast.error('Could not delete', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Meter rates</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add new rate"
            accessibilityState={{ disabled: !!form }}
            disabled={!!form}
            onPress={() => {
              setError(null);
              setForm({ name: '', price: '', base: '' });
            }}
            style={({ pressed }) => [styles.addButton, pressed && !form && styles.addButtonPressed, !!form && styles.addButtonDisabled]}
          >
            <Ionicons name="add" size={24} color={colors.onPrimary} />
          </Pressable>
        </View>
        <Text style={styles.hint}>Tap a rate to use it for the next trip.</Text>

        {rates.map((r) => {
          const active = r.id === activeRateId;
          return (
            <View key={r.id} style={[styles.card, active && styles.cardActive]}>
              <View style={styles.rateMainRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setActiveRateId(r.id)}
                  style={styles.rateDetails}
                >
                  <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.meta}>
                    {money(r.price_per_km)} per km
                    {r.base_fare > 0 ? ` · base ${money(r.base_fare)}` : ''}
                  </Text>
                </Pressable>
                {active && (
                  <View style={styles.activeBadge}>
                    <Ionicons name="checkmark-circle" size={15} color={colors.success} />
                    <Text style={styles.activeText}>SELECTED</Text>
                  </View>
                )}
              </View>
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setForm({ id: r.id, name: r.name, price: String(r.price_per_km), base: String(r.base_fare) })}
                  style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
                >
                  <Ionicons name="create-outline" size={16} color={colors.primaryStrong} />
                  <Text style={styles.link}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => remove(r)}
                  style={({ pressed }) => [styles.actionButton, styles.deleteAction, pressed && styles.actionPressed]}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  <Text style={[styles.link, styles.deleteText]}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {rates.length === 0 && <Text style={styles.hint}>No rates yet. Tap + to add your first rate.</Text>}

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
          error && <Text style={styles.error}>{error}</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 64, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: { opacity: 0.85 },
  addButtonDisabled: { opacity: 0.45 },
  hint: { color: colors.muted },
  card: {
    padding: 14,
    borderRadius: radius.md,
    gap: 12,
    ...cardStyle,
  },
  cardActive: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  rateMainRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rateDetails: { flex: 1, minWidth: 0 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: '#DCFCE7' },
  activeText: { color: colors.success, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  name: { color: colors.text, fontWeight: '700', fontSize: 16, flexShrink: 1 },
  meta: { color: colors.muted, marginTop: 4 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, borderTopWidth: 1, borderColor: colors.border, paddingTop: 10 },
  actionButton: { minWidth: 88, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  deleteAction: { backgroundColor: '#FFF1F2' },
  actionPressed: { opacity: 0.75 },
  link: { color: colors.primaryStrong, fontWeight: '700', fontSize: 13 },
  deleteText: { color: colors.danger },
  form: {
    marginTop: 12,
    padding: 18,
    borderRadius: radius.lg,
    ...cardStyle,
  },
  formTitle: { color: colors.text, fontWeight: '800', fontSize: 18 },
  error: { color: colors.danger, marginTop: 10 },
});