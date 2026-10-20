import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { GradientBackdrop } from '../components/GradientBackdrop';
import { GoogleLogo } from '../components/GoogleLogo';
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
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <GradientBackdrop colors={['#FFFFFF', '#FFFBF2']} />
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />
      <View style={styles.blobDot} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.wrap}>
          <Text style={styles.kicker}>BERZH MATE</Text>
          <Text style={styles.title}>Welcome back</Text>

          <AnimatedButton
            label="Continue with Google"
            variant="ghost"
            disabled={busy}
            onPress={() => run(signInWithGoogle)}
            icon={<GoogleLogo />}
            style={{ marginTop: 24 }}
          />

          <Text style={styles.or}>or</Text>

          <TextField label="Email" value={email} onChangeText={setEmail} keyboard="email-address" placeholder="you@example.com" />
          <TextField label="Password" value={password} onChangeText={setPassword} secure placeholder="Your password" />

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={17} color={colors.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          <AnimatedButton label={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={signIn} style={{ marginTop: 18 }} />

          <Pressable onPress={() => router.push('/sign-up')} style={{ marginTop: 18, alignItems: 'center' }}>
            <Text style={styles.link}>New here? Create an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  // Soft amber blobs over the gradient.
  blobTop: { position: 'absolute', top: -90, right: -70, width: 230, height: 230, borderRadius: 115, backgroundColor: '#FCD34D', opacity: 0.1 },
  blobBottom: { position: 'absolute', bottom: -110, left: -80, width: 250, height: 250, borderRadius: 125, backgroundColor: '#FDBA74', opacity: 0.08 },
  blobDot: { position: 'absolute', top: 130, left: 28, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, opacity: 0.05 },
  safe: { flex: 1 },
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  kicker: { color: colors.accent, letterSpacing: 3, fontWeight: '700', fontSize: 12 },
  title: { color: colors.text, fontSize: 40, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  or: { color: colors.muted, textAlign: 'center', marginTop: 16 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF1F2',
    borderColor: '#FFE4E6',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  error: { color: colors.danger, flex: 1, fontSize: 13, lineHeight: 18 },
  link: { color: colors.accent, fontWeight: '600' },
});
