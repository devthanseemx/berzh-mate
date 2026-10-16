import Mapbox from '@rnmapbox/maps';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import '../services/location';
import { initSession, useSession } from '../store/session';
import { colors } from '../theme/colors';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

// Sends signed-out users to the sign-in screen, and signed-in users away from it.
function AuthGate() {
  const session = useSession((s) => s.session);
  const ready = useSession((s) => s.ready);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onAuthScreen = segments[0] === 'sign-in' || segments[0] === 'sign-up';
    if (!session && !onAuthScreen) router.replace('/sign-in');
    if (session && onAuthScreen) router.replace('/');
  }, [ready, session, segments]);

  return null;
}

export default function RootLayout() {
  const ready = useSession((s) => s.ready);

  useEffect(() => {
    initSession();
  }, []);

  // Shows a blank screen while the saved session loads, so the wrong screen doesn't flash.
  if (!ready) return <View style={styles.blank} />;

  return (
    <>
      <AuthGate />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade_from_bottom',
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.bg },
});