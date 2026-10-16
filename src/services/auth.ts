import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
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

export function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim(), password });
}

export function signUpWithEmail(fullName: string, email: string, password: string) {
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: fullName.trim() } },
  });
}

// Opens Google sign-in in a browser window and stores the session when it returns.
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error ?? new Error('Google sign-in is not available.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT);
  if (result.type !== 'success') return; // the user closed the browser

  // Split the returned link into its query part (?code=) and hash part (#access_token=).
  const [beforeHash, hash = ''] = result.url.split('#');
  const query = new URLSearchParams(beforeHash.split('?')[1] ?? '');
  const fragment = new URLSearchParams(hash);

  const errorText = fragment.get('error_description') ?? query.get('error_description');
  if (errorText) throw new Error(errorText.replace(/\+/g, ' '));

  const code = query.get('code');
  if (code) {
    const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
    if (codeError) throw codeError;
    return;
  }

  const access_token = fragment.get('access_token');
  const refresh_token = fragment.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError) throw sessionError;
    return;
  }

  throw new Error('Google sign-in did not return a session.');
}

export function signOut() {
  return supabase.auth.signOut();
}