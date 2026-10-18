import { router, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { TextField } from '../../components/TextField';
import { claimInvites, createGroup, listGroups, type GroupRow } from '../../services/groups';
import { colors, radius } from '../../theme/colors';

export default function Groups() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      await claimInvites(); // links trips you were invited to by Gmail
      setGroups(await listGroups());
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

  const create = async () => {
    if (!name.trim()) return setError('Enter a trip name.');
    setBusy(true);
    setError(null);
    try {
      const gid = await createGroup(name);
      setName('');
      router.push(`/groups/${gid}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Trip groups</Text>
        <Text style={styles.hint}>Split shared costs and see each other on the map during a trip.</Text>

        <View style={styles.card}>
          <TextField label="New trip" value={name} onChangeText={setName} placeholder="e.g. Ella weekend" />
          {error && <Text style={styles.error}>{error}</Text>}
          <AnimatedButton label={busy ? 'Creating…' : 'Create trip'} disabled={busy} onPress={create} style={{ marginTop: 14 }} />
        </View>

        {groups.length === 0 && <Text style={styles.hint}>No trips yet.</Text>}

        {groups.map((g) => (
          <Pressable key={g.id} onPress={() => router.push(`/groups/${g.id}`)} style={styles.tripCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.tripName}>{g.name}</Text>
              <Text style={styles.hint}>
                {new Date(g.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <Text style={[styles.badge, g.status === 'active' ? styles.badgeActive : styles.badgeDone]}>
              {g.status === 'active' ? 'Active' : 'Finished'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 12 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  hint: { color: colors.muted, fontSize: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  error: { color: colors.danger, marginTop: 8 },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  badgeActive: { color: colors.bg, backgroundColor: colors.primary },
  badgeDone: { color: colors.bg, backgroundColor: colors.muted },
});