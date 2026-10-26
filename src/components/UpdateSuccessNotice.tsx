import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedButton } from './AnimatedButton';
import { colors, radius, shadow } from '../theme/colors';
import {
  clearPendingInstallNotice,
  getReleaseNotes,
  PENDING_INSTALL_NOTICE_KEY,
  type UpdateNoticeDetails,
} from '../services/updateNotice';

const LAST_VERSION_KEY = 'berzh-mate-last-launched-version';
const LAST_UPDATE_ID_KEY = 'berzh-mate-last-launched-update-id';
const PENDING_NOTICE_KEY = 'berzh-mate-pending-update-success';
const FALLBACK_APK_NOTES = 'The latest version of Berzh Mate has been installed.';
const FALLBACK_OTA_NOTES = 'The latest in-app improvements and fixes are now active.';

type SuccessNotice = UpdateNoticeDetails & { kind: 'app' | 'in-app' };

function isNotice(value: unknown): value is UpdateNoticeDetails {
  if (!value || typeof value !== 'object') return false;
  const notice = value as Partial<UpdateNoticeDetails>;
  return typeof notice.version === 'string' && typeof notice.notes === 'string';
}

function getManifestMessage(): string | null {
  const manifest = Updates.manifest;
  if (!('metadata' in manifest)) return null;
  const metadata = manifest.metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const message = (metadata as Record<string, unknown>).message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}

export function UpdateSuccessNotice() {
  const [notice, setNotice] = useState<SuccessNotice | null>(null);

  useEffect(() => {
    let active = true;
    const currentVersion = Constants.expoConfig?.version ?? '0.0.0';
    const currentUpdateId = Updates.updateId;

    const checkForAppliedUpdate = async () => {
      try {
        const values = await AsyncStorage.multiGet([
          LAST_VERSION_KEY,
          LAST_UPDATE_ID_KEY,
          PENDING_INSTALL_NOTICE_KEY,
          PENDING_NOTICE_KEY,
        ]);
        const previousVersion = values[0][1];
        const previousUpdateId = values[1][1];
        const pendingInstall = values[2][1];
        const pendingNotice = values[3][1];
        let nextNotice: SuccessNotice | null = null;

        if (pendingNotice) {
          try {
            const parsed: unknown = JSON.parse(pendingNotice);
            if (isNotice(parsed) && (parsed as SuccessNotice).kind) {
              nextNotice = parsed as SuccessNotice;
            } else {
              await AsyncStorage.removeItem(PENDING_NOTICE_KEY);
            }
          } catch {
            await AsyncStorage.removeItem(PENDING_NOTICE_KEY);
          }
        }

        if (pendingInstall) {
          try {
            const parsed: unknown = JSON.parse(pendingInstall);
            if (!nextNotice && isNotice(parsed) && parsed.version === currentVersion) {
              nextNotice = {
                ...parsed,
                notes: parsed.notes || FALLBACK_APK_NOTES,
                kind: 'app',
              };
            }
          } catch {
            console.warn('Could not read the pending app-update details.');
          }
          await clearPendingInstallNotice();
        }

        if (!nextNotice && previousVersion && previousVersion !== currentVersion) {
          let notes = '';
          try {
            notes = await getReleaseNotes(currentVersion);
          } catch (error: unknown) {
            console.warn('Could not load app release notes:', error);
          }
          nextNotice = {
            version: currentVersion,
            notes: notes || FALLBACK_APK_NOTES,
            kind: 'app',
          };
        }

        if (
          !nextNotice &&
          currentUpdateId &&
          previousUpdateId &&
          currentUpdateId !== previousUpdateId &&
          !Updates.isEmbeddedLaunch
        ) {
          nextNotice = {
            version: currentVersion,
            notes: getManifestMessage() ?? FALLBACK_OTA_NOTES,
            kind: 'in-app',
          };
        }

        await AsyncStorage.setItem(LAST_VERSION_KEY, currentVersion);
        if (currentUpdateId) {
          await AsyncStorage.setItem(LAST_UPDATE_ID_KEY, currentUpdateId);
        }

        if (nextNotice) {
          await AsyncStorage.setItem(PENDING_NOTICE_KEY, JSON.stringify(nextNotice));
          if (active) setNotice(nextNotice);
        }
      } catch (error: unknown) {
        console.warn('Could not check for an applied app update:', error);
      }
    };

    void checkForAppliedUpdate();
    return () => {
      active = false;
    };
  }, []);

  const dismiss = async () => {
    try {
      await AsyncStorage.removeItem(PENDING_NOTICE_KEY);
      setNotice(null);
    } catch (error: unknown) {
      console.warn('Could not dismiss the app-update notice:', error);
      setNotice(null);
    }
  };

  return (
    <Modal
      transparent
      visible={!!notice}
      animationType="fade"
      onRequestClose={() => void dismiss()}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="checkmark" size={28} color={colors.success} />
          </View>
          <Text style={styles.title}>Update successful</Text>
          <Text style={styles.subtitle}>
            Berzh Mate {notice?.version} has been updated.
          </Text>
          <Text style={styles.sectionTitle}>
            {notice?.kind === 'in-app' ? "What's improved" : "What's new"}
          </Text>
          <ScrollView style={styles.notesScroll} contentContainerStyle={styles.notesContent}>
            <Text style={styles.notes}>{notice?.notes}</Text>
          </ScrollView>
          <AnimatedButton label="OK" onPress={() => void dismiss()} />
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
    padding: 20,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    ...shadow.float,
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#DCFCE7',
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 },
  notesScroll: {
    maxHeight: 230,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  notesContent: { flexGrow: 1 },
  notes: { color: colors.text, fontSize: 13, lineHeight: 19 },
});
