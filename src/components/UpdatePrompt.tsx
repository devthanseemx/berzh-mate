import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useToast } from './Toast';
import { downloadAndInstallUpdate, type UpdateInfo } from '../services/updates';
import { colors, radius, shadow } from '../theme/colors';
import { AnimatedButton } from './AnimatedButton';

export function UpdatePrompt({
  info,
  visible,
  onClose,
}: {
  info: NonNullable<UpdateInfo> | null;
  visible: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canInstall = Platform.OS === 'android' && !!info?.apkUrl;

  const install = async () => {
    if (!info || !canInstall || downloading) return;
    setDownloading(true);
    setProgress(0);
    setErrorMessage(null);
    try {
      await downloadAndInstallUpdate(info, setProgress);
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again later.';
      setErrorMessage(message);
      toast.error('Could not install update', message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      transparent
      visible={visible && !!info}
      animationType="fade"
      onRequestClose={() => {
        if (!downloading) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="download-outline" size={23} color={colors.primaryStrong} />
          </View>
          <Text style={styles.title}>Berzh Mate {info?.version} is available</Text>
          <Text style={styles.message}>
            The APK downloads inside the app. Android may ask you to allow installs from Berzh Mate, then confirm the update.
          </Text>
          {!!info?.notes && (
            <ScrollView style={styles.notesScroll} nestedScrollEnabled>
              <Text style={styles.notes}>{info.notes}</Text>
            </ScrollView>
          )}
          {downloading && (
            <View style={styles.progressRow}>
              <ActivityIndicator color={colors.primaryStrong} />
              <Text style={styles.progressText}>
                Downloading update{progress > 0 ? ` · ${Math.round(progress * 100)}%` : '…'}
              </Text>
            </View>
          )}
          {!!errorMessage && <Text style={styles.warning}>{errorMessage}</Text>}
          {!info?.apkUrl && (
            <Text style={styles.warning}>No APK is attached to this release yet.</Text>
          )}
          {Platform.OS !== 'android' && (
            <Text style={styles.warning}>APK installation is only available on Android.</Text>
          )}
          <View style={styles.actions}>
            <AnimatedButton
              small
              label={downloading ? 'Downloading…' : 'Install update'}
              onPress={install}
              disabled={!canInstall || downloading}
              style={{ flex: 1 }}
            />
            <AnimatedButton
              small
              label="Later"
              variant="ghost"
              onPress={onClose}
              disabled={downloading}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '82%',
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    ...shadow.float,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 18 },
  message: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  notesScroll: { maxHeight: 160, padding: 12, borderRadius: radius.md, backgroundColor: colors.bg },
  notes: { color: colors.text, fontSize: 12, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressText: { color: colors.primaryStrong, fontSize: 13, fontWeight: '700' },
  warning: { color: colors.danger, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
