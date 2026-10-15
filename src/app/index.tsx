import { router, type Href } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { MotiView } from 'moti';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { signIn, signOut, signUp, supabase } from '../services/auth';
import { useTripStore } from '../store/tripStore';
import { colors, radius } from '../theme/colors';

const ACTIONS: { label: string; hint: string; href: Href }[] = [
  { label: 'Plan a route', hint: 'Tap the map to add stops', href: '/plan' },
  { label: 'Trip calculator', hint: 'Fuel cost and split per person', href: '/calculator' },
];

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useTripStore((s) => s.stops.filter((x) => x.status === 'pending').length);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (mode: 'in' | 'up') => {
    setBusy(true);
    const { error } = mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (error) Alert.alert('Account', error.message);
    else if (mode === 'up') Alert.alert('Check your inbox', 'Confirm your email, then sign in.');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <MotiView from={{ opacity: 0, translateY: -16 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 500 }}>
          <Text style={styles.kicker}>BERZH MATE</Text>
          <Text style={styles.title}>Where to next?</Text>
          <Text style={styles.sub}>
            {pending ? `${pending} stop${pending > 1 ? 's' : ''} planned` : 'Plan a multi-stop route in seconds'}
          </Text>
        </MotiView>

        {ACTIONS.map((a, i) => (
          <MotiView
            key={a.label}
            from={{ opacity: 0, translateY: 24 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 450, delay: 150 + i * 100 }}
            style={styles.card}
          >
            <Text style={styles.cardTitle}>{a.label}</Text>
            <Text style={styles.cardHint}>{a.hint}</Text>
            <AnimatedButton label="Open" onPress={() => router.push(a.href)} style={{ marginTop: 14 }} />
          </MotiView>
        ))}

        <MotiView
          from={{ opacity: 0, translateY: 24 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 450, delay: 350 }}
          style={styles.card}
        >
          {session ? (
            <>
              <Text style={styles.cardTitle}>Signed in</Text>
              <Text style={styles.cardHint}>{session.user.email}</Text>
              <AnimatedButton label="Sign out" variant="ghost" onPress={signOut} style={{ marginTop: 14 }} />
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Account</Text>
              <TextInput
                placeholder="Email"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
              />
              <TextInput
                placeholder="Password"
                placeholderTextColor={colors.muted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={styles.input}
              />
              <View style={styles.row}>
                <AnimatedButton label="Sign in" disabled={busy} onPress={() => submit('in')} style={{ flex: 1 }} />
                <AnimatedButton label="Create" variant="ghost" disabled={busy} onPress={() => submit('up')} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </MotiView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 16 },
  kicker: { color: colors.primary, letterSpacing: 3, fontWeight: '700', fontSize: 12 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 6 },
  sub: { color: colors.muted, marginTop: 4, fontSize: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  cardHint: { color: colors.muted, marginTop: 4 },
  input: { backgroundColor: colors.surfaceAlt, color: colors.text, borderRadius: radius.md, padding: 14, marginTop: 12, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
});