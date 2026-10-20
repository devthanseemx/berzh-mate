import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { GradientBackdrop } from '../components/GradientBackdrop';
import { GoogleLogo } from '../components/GoogleLogo';
import { TextField } from '../components/TextField';
import { signInWithGoogle, signUpWithEmail } from '../services/auth';
import { colors } from '../theme/colors';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google creates the account on first sign-in and fills in the name and email for you.
  const google = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      setError(e.message ?? 'Google sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (name.trim().length < 2) return setError('Enter your full name.');
    if (!email.includes('@')) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');

    setBusy(true);
    setError(null);
    try {
      const { data, error } = await signUpWithEmail(name, email, password);
      if (error) throw error;

      // With email confirmation on, there's no session until the link is opened.
      if (!data.session) {
        Alert.alert('Check your email', 'We sent a confirmation link. Open it on this phone to continue.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      setError(e.message ?? 'Could not create the account.');
    } finally {
      setBusy(false);
    }
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.hint}>The quickest way is with your Google account. No typing needed.</Text>

          <AnimatedButton
            label="Continue with Google"
            variant="ghost"
            disabled={busy}
            onPress={google}
            icon={<GoogleLogo />}
            style={{ marginTop: 22 }}
          />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>or sign up with email</Text>
            <View style={styles.line} />
          </View>

          <TextField label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
          <TextField label="Email" value={email} onChangeText={setEmail} keyboard="email-address" placeholder="you@example.com" />
          <TextField label="Password" value={password} onChangeText={setPassword} secure placeholder="At least 6 characters" />

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={17} color={colors.danger} />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          <AnimatedButton label={busy ? 'Creating…' : 'Create account'} disabled={busy} onPress={create} style={{ marginTop: 18 }} />

          <Pressable onPress={() => router.back()} style={{ marginTop: 18, alignItems: 'center' }}>
            <Text style={styles.link}>Already have an account? Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  // Soft amber blobs over the gradient.
  blobTop: { position: 'absolute', top: -80, left: -70, width: 210, height: 210, borderRadius: 105, backgroundColor: '#FCD34D', opacity: 0.1 },
  blobBottom: { position: 'absolute', bottom: -100, right: -80, width: 250, height: 250, borderRadius: 125, backgroundColor: '#FDBA74', opacity: 0.08 },
  blobDot: { position: 'absolute', top: 110, right: 36, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, opacity: 0.05 },
  safe: { flex: 1 },
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  kicker: { color: colors.accent, letterSpacing: 3, fontWeight: '700', fontSize: 12 },
  title: { color: colors.text, fontSize: 36, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
  hint: { color: colors.muted, marginTop: 6 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.muted, fontSize: 12 },
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
