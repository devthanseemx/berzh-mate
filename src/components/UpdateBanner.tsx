import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { checkForUpdate, installedVersion, type UpdateInfo } from '../services/updates';
import { colors, radius, shadow } from '../theme/colors';
import { AnimatedButton } from './AnimatedButton';
import { UpdatePrompt } from './UpdatePrompt';

const DISMISSED_KEY = 'berzh-mate-dismissed-update';

export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo>(null);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    (async () => {
      let update: UpdateInfo;
      try {
        update = await checkForUpdate();
      } catch (error: unknown) {
        console.warn('Could not check for app updates:', error);
        return;
      }
      if (!update) return;
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
      if (dismissed !== update.version) setInfo(update);
    })();
  }, []);

  const later = async () => {
    if (!info) return;
    await AsyncStorage.setItem(DISMISSED_KEY, info.version);
    setInfo(null);
  };

  return (
    <>
      {info && (
        <View style={styles.card}>
          <View style={styles.heading}>
            <View style={styles.icon}>
              <Ionicons name="arrow-down-circle-outline" size={20} color={colors.primaryStrong} />
            </View>
            <View style={styles.headingText}>
              <Text style={styles.title}>Update available</Text>
              <Text style={styles.version}>Berzh Mate v{info.version}</Text>
            </View>
          </View>
          <Text style={styles.sub}>
            You have v{installedVersion}. Install the latest version to get the newest improvements.
          </Text>
          {!!info.notes && (
            <Text style={styles.notes} numberOfLines={4}>
              {info.notes}
            </Text>
          )}
          <View style={styles.row}>
            <AnimatedButton small label="Update now" onPress={() => setPromptOpen(true)} style={{ flex: 1 }} />
            <AnimatedButton small label="Later" variant="ghost" onPress={later} style={{ flex: 1 }} />
          </View>
        </View>
      )}
      <UpdatePrompt info={info} visible={promptOpen} onClose={() => setPromptOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...shadow.float,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  headingText: { flex: 1, gap: 2 },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  version: { color: colors.primaryStrong, fontWeight: '700', fontSize: 12 },
  sub: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  notes: { color: colors.text, fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
