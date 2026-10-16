import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { TextField } from '../components/TextField';
import { signInWithEmail, signInWithGoogle } from '../services/auth';
import { colors } from '../theme/colors';

// Turns Supabase error messages into plain language.
function friendly(message: string): string {
  if (/invalid login/i.test(message)) return 'Wrong email or password.';
  if (/not confirmed/i.test(message)) return 'Confirm your email first. Check your inbox.';
  if (/network|fetch/i.test(message)) return 'No connection. Check your internet and try again.';
  return message;
}

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(friendly(e.message ?? 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  const signIn = () => {
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    return run(async () => {
      const { error } = await signInWithEmail(email, password);
      if (error) throw error;
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.kicker}>BERZH MATE</Text>
        <Text style={styles.title}>Welcome back</Text>

        <AnimatedButton label="Continue with Google" variant="ghost" disabled={busy} onPress={() => run(signInWithGoogle)} style={{ marginTop: 24 }} />

        <Text style={styles.or}>or</Text>

        <TextField label="Email" value={email} onChangeText={setEmail} keyboard="email-address" placeholder="you@example.com" />
        <TextField label="Password" value={password} onChangeText={setPassword} secure placeholder="Your password" />

        {error && <Text style={styles.error}>{error}</Text>}

        <AnimatedButton label={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={signIn} style={{ marginTop: 18 }} />

        <Pressable onPress={() => router.push('/sign-up')} style={{ marginTop: 18, alignItems: 'center' }}>
          <Text style={styles.link}>New here? Create an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  kicker: { color: colors.primary, letterSpacing: 3, fontWeight: '700', fontSize: 12 },
  title: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: 6 },
  or: { color: colors.muted, textAlign: 'center', marginTop: 16 },
  error: { color: colors.danger, marginTop: 14 },
  link: { color: colors.primary, fontWeight: '600' },
});