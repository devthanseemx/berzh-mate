import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimatedButton } from '../components/AnimatedButton';
import { BackButton } from '../components/BackButton';
import { TextField } from '../components/TextField';
import { useToast } from '../components/Toast';
import { getProfile, pickAndUploadAvatar, type Profile, updateEmail, updateFullName } from '../services/profile';
import { colors } from '../theme/colors';

export default function Account() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  // Google accounts get their email from Google, so it can't be changed here.
  const isGoogle = profile?.provider === 'google';

  useEffect(() => {
    getProfile()
      .then((p) => {
        if (!p) return;
        setProfile(p);
        setName(p.fullName);
        setEmail(p.email);
      })
      .catch((e) => setError(e.message));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong.');
      toast.error('Update failed', e.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      if (!name.trim()) throw new Error('Name cannot be empty.');
      if (name.trim() !== profile?.fullName) await updateFullName(name);

      if (!isGoogle && email.trim() !== profile?.email) {
        if (!email.includes('@')) throw new Error('Enter a valid email address.');
        await updateEmail(email);
        toast.success('Check your email', 'Confirm the new address to finish.');
      } else {
        toast.success('Saved', 'Your profile is up to date.');
      }
      setProfile((p) => (p ? { ...p, fullName: name.trim() } : p));
    });

  const changePhoto = () =>
    run(async () => {
      const url = await pickAndUploadAvatar();
      if (url) {
        setProfile((p) => (p ? { ...p, avatarUrl: url } : p));
        toast.success('Saved', 'Photo updated.');
      }
    });

  const initial = (profile?.fullName || profile?.email || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarRow}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <AnimatedButton label="Change photo" variant="ghost" disabled={busy} onPress={changePhoto} style={{ flex: 1 }} />
        </View>

        <TextField label="Full name" value={name} onChangeText={setName} />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboard="email-address"
          editable={!isGoogle}
          note={isGoogle ? 'Signed in with Google. Change your email in your Google account.' : 'Changing your email sends a confirmation link.'}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <AnimatedButton label={busy ? 'Saving…' : 'Save changes'} disabled={busy} onPress={save} style={{ marginTop: 20 }} />
        <AnimatedButton label="Back" variant="ghost" onPress={() => router.back()} style={{ marginTop: 14 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingTop: 64, gap: 4 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.accent, fontSize: 28, fontWeight: '800' },
  good: { color: colors.accent, marginTop: 14 },
  error: { color: colors.danger, marginTop: 14 },
});