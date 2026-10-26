import Mapbox from '@rnmapbox/maps';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import '../services/location';
import '../services/meterLocation';
import { completeAuthFromUrl } from '../services/auth';
import { isGoogleMapsUrl } from '../services/googleMapsLinks';
import { ConfirmProvider } from '../components/Confirm';
import { UpdateSuccessNotice } from '../components/UpdateSuccessNotice';
import { ToastProvider, useToast } from '../components/Toast';
import { initSession, useSession } from '../store/session';
import { colors } from '../theme/colors';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter';
import '../theme/font';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN!);

// Sends signed-out users to the sign-in screen, and signed-in users away from it.
function AuthGate({
  incomingMapUrl,
  onIncomingMapHandled,
}: {
  incomingMapUrl: string | null;
  onIncomingMapHandled: () => void;
}) {
  const session = useSession((s) => s.session);
  const ready = useSession((s) => s.ready);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const onAuthScreen = segments[0] === 'sign-in' || segments[0] === 'sign-up';
    if (!session && !onAuthScreen) router.replace('/sign-in');
    if (!session || !incomingMapUrl) {
      if (session && onAuthScreen) router.replace('/');
      return;
    }
    const destination = { pathname: '/(tabs)/plan' as const, params: { mapsUrl: incomingMapUrl } };
    if (onAuthScreen) router.replace(destination);
    else router.push(destination);
    onIncomingMapHandled();
  }, [incomingMapUrl, onIncomingMapHandled, ready, session, segments, router]);

  return null;
}

// Greets the user with a toast right after they sign in (not on cold starts).
function WelcomeToast() {
  const toast = useToast();
  const session = useSession((s) => s.session);
  const ready = useSession((s) => s.ready);
  const sawSignedOut = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      sawSignedOut.current = true;
      return;
    }
    if (sawSignedOut.current) toast.success('Signed in', 'Welcome back!');
    sawSignedOut.current = false;
  }, [session, ready, toast]);

  return null;
}

export default function RootLayout() {
  const ready = useSession((s) => s.ready);
  const [incomingMapUrl, setIncomingMapUrl] = useState<string | null>(null);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    initSession();
  }, []);

  // Completes sign-in when the app is opened by a berzhmate:// link, such as a
  // confirmation email or a Google sign-in returned by the system browser.
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      if (isGoogleMapsUrl(url)) {
        setIncomingMapUrl(url);
        return;
      }
      completeAuthFromUrl(url).catch((e) => Alert.alert('Sign-in failed', e.message));
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  if (!ready || !fontsLoaded) return <View style={styles.blank} />;

  return (
    <ToastProvider>
      <ConfirmProvider>
        <StatusBar style="dark" />
        <AuthGate incomingMapUrl={incomingMapUrl} onIncomingMapHandled={() => setIncomingMapUrl(null)} />
        <WelcomeToast />
        <UpdateSuccessNotice />
        <Stack
          screenOptions={{
            // No header bar at all — pushed screens render the floating BackButton,
            // so every pixel goes to content.
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'fade_from_bottom',
          }}
        />
      </ConfirmProvider>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: colors.bg },
});
