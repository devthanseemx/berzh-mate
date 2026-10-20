import { router } from 'expo-router';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { useSettings } from '../store/settings';
import { colors, radius } from '../theme/colors';

export default function Settings() {
  const saveHistory = useSettings((s) => s.saveHistory);
  const setSaveHistory = useSettings((s) => s.setSaveHistory);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.section}>Trips</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Save trips to history</Text>
            <Text style={styles.hint}>
              On: finished route and meter trips are saved to your account until you delete them.
              Off: finished trips are not saved anywhere.
            </Text>
          </View>
          <Switch
            value={saveHistory}
            onValueChange={setSaveHistory}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <Text style={[styles.section, { marginTop: 24 }]}>Account</Text>
        <AnimatedButton label="Account settings" variant="ghost" onPress={() => router.push('/account')} />
        <AnimatedButton label="Meter rates" variant="ghost" onPress={() => router.push('/meter/rates')} style={{ marginTop: 10 }} />
        <AnimatedButton label="Back" onPress={() => router.back()} style={{ marginTop: 24 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 20, gap: 8 },
  section: { color: colors.primary, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginTop: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.text, fontWeight: '700', fontSize: 16 },
  hint: { color: colors.muted, marginTop: 4, fontSize: 12, lineHeight: 17 },
});