import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../../components/AnimatedButton';
import { BackButton } from '../../components/BackButton';
import { useToast } from '../../components/Toast';
import { capitalize } from '../../utils/format';
import { supabase } from '../../services/auth';
import { getInvite, joinInvite } from '../../services/groups';
import { PENDING_JOIN_KEY } from '../../services/pendingJoin';
import { cardStyle, colors, radius } from '../../theme/colors';

export default function JoinTrip() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [info, setInfo] = useState<{ group_id: string; name: string; status: string; members: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    getInvite(token).then(setInfo).catch((e) => setError(e.message));
  }, [token]);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Remember the invite, so the app can continue joining after sign-in.
        await AsyncStorage.setItem(PENDING_JOIN_KEY, token);
        router.replace('/sign-in');
        return;
      }
      const gid = await joinInvite(token);
      await AsyncStorage.removeItem(PENDING_JOIN_KEY);
      toast.success('Joined', 'You are now part of this trip.');
      router.replace(`/groups/${gid}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <BackButton />
      <View style={styles.card}>
        <Text style={styles.kicker}>TRIP INVITE</Text>
        {!info && !error && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primaryStrong} />
            <Text style={styles.hint}>Loading invite…</Text>
          </View>
        )}
        {error && !info && <Text style={styles.error}>{error}</Text>}
        {info && (
          <>
            <Text style={styles.title}>{capitalize(info.name)}</Text>
            <Text style={styles.hint}>
              {info.members} {info.members === 1 ? 'person' : 'people'} on this trip
            </Text>
            {info.status === 'finished' ? (
              <Text style={styles.error}>This trip has finished.</Text>
            ) : (
              <>
                <Text style={styles.question}>Join this trip?</Text>
                <Text style={styles.hint}>You’ll see the shared expenses and, if you choose, share your location.</Text>
                {error && <Text style={styles.error}>{error}</Text>}
                <AnimatedButton label={busy ? 'Joining…' : 'Join trip'} disabled={busy} onPress={join} style={{ marginTop: 20 }} />
              </>
            )}
          </>
        )}
        <AnimatedButton label="Not now" variant="ghost" onPress={() => router.replace('/')} style={{ marginTop: 10 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: 24 },
  card: { ...cardStyle, borderRadius: radius.lg, padding: 24 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  kicker: { color: colors.accent, letterSpacing: 2, fontSize: 11, fontWeight: '700' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 6 },
  question: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 16 },
  hint: { color: colors.muted, marginTop: 6 },
  error: { color: colors.danger, marginTop: 10 },
});