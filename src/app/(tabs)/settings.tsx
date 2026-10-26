import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConfirm } from '../../components/Confirm';
import { SavedPlacesSheet } from '../../components/SavedPlacesSheet';
import { useToast } from '../../components/Toast';
import { UpdatePrompt } from '../../components/UpdatePrompt';
import { signOut } from '../../services/auth';
import { deleteAccount } from '../../services/profile';
import { checkForUpdate, installedVersion, type UpdateInfo } from '../../services/updates';
import { useSavedPlaces } from '../../store/savedPlaces';
import { useSettings } from '../../store/settings';
import { cardStyle, colors, radius } from '../../theme/colors';

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
  const [savedPlacesOpen, setSavedPlacesOpen] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo>(null);
  const [updatePromptOpen, setUpdatePromptOpen] = useState(false);
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

  const checkUpdates = async () => {
    setCheckingUpdates(true);
    try {
      const update = await checkForUpdate();
      if (!update) {
        toast.success('You’re up to date', `Berzh Mate ${installedVersion} is the latest version.`);
        return;
      }
      setUpdateInfo(update);
      setUpdatePromptOpen(true);
    } catch (error: unknown) {
      toast.error(
        'Could not check for updates',
        error instanceof Error ? error.message : 'Check your connection and try again.'
      );
    } finally {
      setCheckingUpdates(false);
    }
  };

  const openMapData = () => {
    void Linking.openURL('https://www.openstreetmap.org/copyright').catch((error: unknown) => {
      toast.error('Could not open map data information', error instanceof Error ? error.message : 'Try again later.');
    });
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
          <Row
            icon="bookmark-outline"
            label="Saved places"
            hint={`${savedCount} saved · select one to view it on the map.`}
            onPress={() => setSavedPlacesOpen(true)}
          />
        </View>

        <Text style={styles.section}>About</Text>
        <View style={styles.card}>
          <Row
            icon="information-circle-outline"
            label="Berzh Mate"
            hint={
              checkingUpdates
                ? 'Checking for updates…'
                : `Version ${installedVersion} · Tap to check for updates.`
            }
            onPress={checkingUpdates ? undefined : checkUpdates}
          />
          <View style={styles.divider} />
          <Row
            icon="map-outline"
            label="Maps & data"
            hint="Maps © OpenStreetMap · Search and routing by Geoapify."
            onPress={openMapData}
          />
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
      <SavedPlacesSheet
        visible={savedPlacesOpen}
        onSelect={(place) => {
          setSavedPlacesOpen(false);
          router.push({ pathname: '/plan', params: { saved: place.id } });
        }}
        onClose={() => setSavedPlacesOpen(false)}
      />
      <UpdatePrompt
        info={updateInfo}
        visible={updatePromptOpen}
        onClose={() => setUpdatePromptOpen(false)}
      />
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
