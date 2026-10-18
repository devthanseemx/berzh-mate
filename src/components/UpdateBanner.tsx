import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { checkForUpdate, installedVersion, type UpdateInfo } from '../services/updates';
import { colors, radius } from '../theme/colors';
import { AnimatedButton } from './AnimatedButton';

const DISMISSED_KEY = 'berzh-mate-dismissed-update';

export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo>(null);

  useEffect(() => {
    (async () => {
      const update = await checkForUpdate();
      if (!update) return;
      const dismissed = await AsyncStorage.getItem(DISMISSED_KEY);
      if (dismissed !== update.version) setInfo(update);
    })();
  }, []);

  if (!info) return null;

  const later = async () => {
    await AsyncStorage.setItem(DISMISSED_KEY, info.version);
    setInfo(null);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Update available: v{info.version}</Text>
      <Text style={styles.sub}>You have v{installedVersion}. Download the new version to get the latest changes.</Text>
      {!!info.notes && (
        <Text style={styles.notes} numberOfLines={4}>
          {info.notes}
        </Text>
      )}
      <View style={styles.row}>
        <AnimatedButton label="Download" onPress={() => Linking.openURL(info.url)} style={{ flex: 1 }} />
        <AnimatedButton label="Later" variant="ghost" onPress={later} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 6,
  },
  title: { color: colors.text, fontWeight: '800', fontSize: 16 },
  sub: { color: colors.muted, fontSize: 12 },
  notes: { color: colors.text, fontSize: 12, marginTop: 4 },
  row: { flexDirection: 'row', gap: 10, marginTop: 8 },
});