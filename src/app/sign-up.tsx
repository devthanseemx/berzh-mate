import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
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
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.hint}>The quickest way is with your Google account. No typing needed.</Text>

        <AnimatedButton
          label="Continue with Google"
          variant="ghost"
          disabled={busy}
          onPress={google}
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

        {error && <Text style={styles.error}>{error}</Text>}

        <AnimatedButton label={busy ? 'Creating…' : 'Create account'} disabled={busy} onPress={create} style={{ marginTop: 18 }} />

        <Pressable onPress={() => router.back()} style={{ marginTop: 18, alignItems: 'center' }}>
          <Text style={styles.link}>Already have an account? Sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  hint: { color: colors.muted, marginTop: 6 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  or: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, marginTop: 14 },
  link: { color: colors.primary, fontWeight: '600' },
});