import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

const REDIRECT = 'berzhmate://auth-callback';

// Reads a sign-in result from a returned link. Handles token links (#access_token=...)
// and code links (?code=...). Returns true if a session was created.
export async function completeAuthFromUrl(url: string): Promise<boolean> {
  if (!url.startsWith(REDIRECT)) return false;

  const [beforeHash, hash = ''] = url.split('#');
  const query = new URLSearchParams(beforeHash.split('?')[1] ?? '');
  const fragment = new URLSearchParams(hash);

  const errorText = fragment.get('error_description') ?? query.get('error_description');
  if (errorText) throw new Error(errorText.replace(/\+/g, ' '));

  const code = query.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const access_token = fragment.get('access_token');
  const refresh_token = fragment.get('refresh_token');
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return true;
  }

  return false;
}

export function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export function signUpWithEmail(fullName: string, email: string, password: string) {
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      // Where the confirmation link returns to after it's opened.
      emailRedirectTo: REDIRECT,
    },
  });
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('Google sign-in is not available.');

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT);
  } catch {
    // No in-app browser on this phone. Use the system browser instead. When Google
    // finishes, the browser opens the app, and the link listener in the root layout
    // completes the sign-in.
    await Linking.openURL(data.url);
    return;
  }

  if (result.type !== 'success') return; // the user closed the browser
  await completeAuthFromUrl(result.url);
}

export function signOut() {
  return supabase.auth.signOut();
}