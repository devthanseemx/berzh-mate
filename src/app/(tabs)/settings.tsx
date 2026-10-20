import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConfirm } from '../../components/Confirm';
import { useToast } from '../../components/Toast';
import { signOut } from '../../services/auth';
import { deleteAccount } from '../../services/profile';
import { useSavedPlaces } from '../../store/savedPlaces';
import { useSettings } from '../../store/settings';
import { cardStyle, colors, radius } from '../../theme/colors';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0';

// Rounded icon tile used by every settings row.
function IconBox({ name, tone = colors.accent, bg = colors.primarySoft }: { name: keyof typeof Ionicons.glyphMap; tone?: string; bg?: string }) {
  return (
    <View style={[styles.iconBox, { backgroundColor: bg }]}>
      <Ionicons name={name} size={18} color={tone} />
    </View>
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
  right,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress?: () => void;
  right?: ReactNode;
  tone?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}>
      <IconBox name={icon} tone={tone} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, tone && { color: tone }]}>{label}</Text>
        {!!hint && <Text style={styles.hint}>{hint}</Text>}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

export default function Settings() {
  const saveHistory = useSettings((s) => s.saveHistory);
  const setSaveHistory = useSettings((s) => s.setSaveHistory);
  const savedCount = useSavedPlaces((s) => s.places.length);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  const signOutWithConfirm = async () => {
    const ok = await confirm({
      title: 'Sign out?',
      message: 'You can sign back in any time with your email or Google account.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    await signOut();
    toast.info('Signed out', 'See you soon.');
  };

  const confirmDelete = async () => {
    const ok = await confirm({
      title: 'Delete account?',
      message: 'This permanently deletes your account, profile, and trip history. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteAccount();
      setDeleteError(null);
      toast.success('Deleted', 'Your account has been removed.');
    } catch (e: any) {
      const msg = e.message ?? 'Could not delete the account.';
      setDeleteError(msg);
      toast.error('Could not delete', msg);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.section}>Trips</Text>
        <View style={styles.card}>
          <Row
            icon="time-outline"
            label="Save trips to history"
            hint="On: finished route and meter trips are saved to your account until you delete them."
            right={
              <Switch
                value={saveHistory}
                onValueChange={setSaveHistory}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </View>

        <Text style={styles.section}>General</Text>
        <View style={styles.card}>
          <Row icon="person-circle-outline" label="Account" onPress={() => router.push('/account')} />
          <View style={styles.divider} />
          <Row icon="speedometer-outline" label="Meter rates" hint="Manage fare profiles for the meter." onPress={() => router.push('/meter/rates')} />
          <View style={styles.divider} />
          <Row icon="stats-chart-outline" label="Credits & usage" hint="Daily search and route credits." onPress={() => router.push('/usage')} />
          <View style={styles.divider} />
          <Row
            icon="bookmark-outline"
            label="Saved places"
            hint={`${savedCount} saved · open the Plan tab to manage them.`}
            onPress={() => router.push('/plan')}
          />
        </View>

        <Text style={styles.section}>About</Text>
        <View style={styles.card}>
          <Row icon="information-circle-outline" label="Berzh Mate" hint={`Version ${APP_VERSION} · trips, meter and group travel in one app.`} />
          <View style={styles.divider} />
          <Row icon="map-outline" label="Maps & data" hint="Maps © OpenStreetMap · Search by Geoapify · Routing by Geoapify." />
        </View>

        <Text style={styles.section}>Session</Text>
        <View style={styles.card}>
          <Row icon="log-out-outline" label="Sign out" tone={colors.accent} onPress={signOutWithConfirm} right={<View />} />
        </View>

        <Text style={styles.section}>Danger zone</Text>
        <View style={styles.dangerCard}>
          <Row
            icon="trash-outline"
            label="Delete account"
            hint="Permanently removes your account, profile and trip history. This cannot be undone."
            tone={colors.danger}
            onPress={confirmDelete}
          />
          {!!deleteError && <Text style={styles.error}>{deleteError}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 8, paddingBottom: 110 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  section: { color: colors.accent, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', fontSize: 12, marginTop: 12 },
  card: {
    borderRadius: radius.lg,
    ...cardStyle,
  },
  dangerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowPressed: { backgroundColor: colors.surfaceAlt },
  iconBox: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, fontWeight: '700', fontSize: 15 },
  hint: { color: colors.muted, marginTop: 2, fontSize: 12, lineHeight: 17 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 62 },
  error: { color: colors.danger, fontSize: 12, paddingHorizontal: 14, paddingBottom: 12 },
});
