import { Redirect } from 'expo-router';

// Handles the return from Google sign-in, so the app doesn't show "Unmatched route".
export default function AuthCallback() {
  return <Redirect href="/" />;
}