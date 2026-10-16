import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { TextField } from '../components/TextField';
import { signUpWithEmail } from '../services/auth';
import { colors } from '../theme/colors';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        Alert.alert('Check your email', 'We sent a confirmation link. Open it, then sign in.', [
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
        <Text style={styles.hint}>You can add a profile picture later in Account settings.</Text>

        <TextField label="Full name" value={name} onChangeText={setName} placeholder="Your name" />
        <TextField label="Email" value={email} onChangeText={setEmail} keyboard="email-address" placeholder="you@example.com" />
        <TextField label="Password" value={password} onChangeText={setPassword} secure placeholder="At least 6 characters" />

        {error && <Text style={styles.error}>{error}</Text>}

        <AnimatedButton label={busy ? 'Creating…' : 'Create account'} disabled={busy} onPress={create} style={{ marginTop: 18 }} />
        <AnimatedButton label="Back to sign in" variant="ghost" onPress={() => router.back()} style={{ marginTop: 10 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  hint: { color: colors.muted, marginTop: 6 },
  error: { color: colors.danger, marginTop: 14 },
});