import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { MotiView } from 'moti';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { TextField } from '../../components/TextField';
import { useToast } from '../../components/Toast';
import { claimInvites, createGroup, joinInvite, listGroups, type GroupRow } from '../../services/groups';
import { cardStyle, colors, radius } from '../../theme/colors';
import { fonts } from '../../theme/font';
import { capitalize } from '../../utils/format';

export default function Groups() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which form is open: none, join, or create.
  const [openForm, setOpenForm] = useState<'join' | 'create' | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await claimInvites(); // links trips you were invited to by Gmail
      setGroups(await listGroups());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const joinByCode = async () => {
    if (!code.trim()) return setError('Enter the invite code.');
    setBusy(true);
    setError(null);
    try {
      const gid = await joinInvite(code);
      setCode('');
      toast.success('Joined', 'You are now part of this trip.');
      router.push(`/groups/${gid}`);
    } catch (e: any) {
      setError(e.message);
      toast.error('Could not join', e.message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!name.trim()) return setError('Enter a trip name.');
    setBusy(true);
    setError(null);
    try {
      const gid = await createGroup(name);
      setName('');
      toast.success('Created', 'Your trip is ready.');
      router.push(`/groups/${gid}`);
    } catch (e: any) {
      setError(e.message);
      toast.error('Could not create', e.message);
    } finally {
      setBusy(false);
    }
  };

  const activeCount = groups.filter((g) => g.status === 'active').length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>BERZH MATE</Text>
        <Text style={styles.title}>Trip groups</Text>
        <Text style={styles.hint}>Split shared costs and see each other on the map during a trip.</Text>

        {/* Two action tiles — tap to open the matching form */}
        <View style={styles.actions}>
          <ActionTile
            icon="enter-outline"
            label="Join with code"
            hint="Have an invite code?"
            on={openForm === 'join'}
            onPress={() => setOpenForm(openForm === 'join' ? null : 'join')}
          />
          <ActionTile
            icon="add-circle-outline"
            label="Create trip"
            hint="Start something new"
            on={openForm === 'create'}
            onPress={() => setOpenForm(openForm === 'create' ? null : 'create')}
          />
        </View>

        {openForm && (
          <MotiView
            key={openForm}
            from={{ opacity: 0, translateY: -8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 220 }}
            style={styles.formCard}
          >
            {openForm === 'join' ? (
              <>
                <Text style={styles.formTitle}>Join a trip</Text>
                <TextField label="Invite code" value={code} onChangeText={setCode} placeholder="e.g. K7QF2M9A" />
                <AnimatedButton label={busy ? 'Joining…' : 'Join trip'} variant="ghost" disabled={busy} onPress={joinByCode} style={{ marginTop: 14 }} />
              </>
            ) : (
              <>
                <Text style={styles.formTitle}>Create a trip</Text>
                <TextField label="Trip name" value={name} onChangeText={setName} placeholder="e.g. Ella weekend" />
                <AnimatedButton label={busy ? 'Creating…' : 'Create trip'} disabled={busy} onPress={create} style={{ marginTop: 14 }} />
              </>
            )}
            {!!error && <Text style={styles.error}>{error}</Text>}
          </MotiView>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.section}>
            {activeCount > 0 ? `Active groups · ${activeCount}` : 'Your groups'}
          </Text>
          {loading && <ActivityIndicator size="small" color={colors.primaryStrong} />}
        </View>

        {!loading && groups.length === 0 && !error && (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={26} color={colors.muted} />
            <Text style={styles.empty}>No trips yet. Create one or join with a code.</Text>
          </View>
        )}

        {groups.map((g, i) => {
          const active = g.status === 'active';
          return (
            <MotiView
              key={g.id}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: i * 40 }}
            >
              <Pressable onPress={() => router.push(`/groups/${g.id}`)} style={({ pressed }) => [styles.tripCard, pressed && styles.tripPressed]}>
                <View style={[styles.tripIcon, !active && styles.tripIconDone]}>
                  <Ionicons name={active ? 'car-outline' : 'checkmark-outline'} size={19} color={active ? colors.accent : colors.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tripName} numberOfLines={1}>{capitalize(g.name)}</Text>
                  <Text style={styles.tripMeta}>
                    {new Date(g.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
                <View style={[styles.badge, active ? styles.badgeActive : styles.badgeDone]}>
                  <View style={[styles.badgeDot, { backgroundColor: active ? colors.success : colors.muted }]} />
                  <Text style={[styles.badgeText, { color: active ? '#065F46' : colors.muted }]}>
                    {active ? 'Active' : 'Finished'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </Pressable>
            </MotiView>
          );
        })}

        {!!error && !openForm && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionTile({
  icon,
  label,
  hint,
  on,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, on && styles.actionOn, pressed && styles.actionPressed]}>
      <View style={[styles.actionIcon, on && styles.actionIconOn]}>
        <Ionicons name={icon} size={20} color={on ? colors.onPrimary : colors.accent} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 12, paddingBottom: 110 },
  kicker: { color: colors.accent, letterSpacing: 3, fontSize: 11, fontWeight: '700', fontFamily: fonts.semibold },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', fontFamily: fonts.extrabold, letterSpacing: -0.4, marginTop: 2 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  action: { ...cardStyle, flex: 1, borderRadius: radius.md, padding: 14, gap: 6 },
  actionOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  actionPressed: { backgroundColor: colors.surfaceAlt },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  actionIconOn: { backgroundColor: colors.primary },
  actionLabel: { color: colors.text, fontWeight: '700', fontSize: 14, fontFamily: fonts.bold },
  actionHint: { color: colors.muted, fontSize: 11 },
  formCard: { ...cardStyle, borderRadius: radius.md, padding: 16, overflow: 'hidden' },
  formTitle: { color: colors.text, fontWeight: '800', fontSize: 16, fontFamily: fonts.bold },
  error: { color: colors.danger, marginTop: 8, fontSize: 13 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  section: { color: colors.text, fontWeight: '700', fontSize: 16, fontFamily: fonts.bold },
  emptyCard: { ...cardStyle, borderRadius: radius.md, padding: 20, alignItems: 'center', gap: 8 },
  empty: { color: colors.muted, textAlign: 'center', fontSize: 13 },
  tripCard: { ...cardStyle, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md, gap: 12 },
  tripPressed: { backgroundColor: colors.surfaceAlt },
  tripIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripIconDone: { backgroundColor: colors.surfaceAlt },
  tripName: { color: colors.text, fontWeight: '700', fontSize: 15, fontFamily: fonts.bold },
  tripMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeActive: { backgroundColor: '#D1FAE5' },
  badgeDone: { backgroundColor: colors.surfaceAlt },
  badgeText: { fontSize: 11, fontWeight: '700' },
});
