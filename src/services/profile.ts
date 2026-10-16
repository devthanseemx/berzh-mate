import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './auth';

export type Profile = {
  id: string;
  email: string;
  provider: string;
  fullName: string;
  avatarUrl: string | null;
};

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? '',
    provider: user.app_metadata?.provider ?? 'email',
    fullName: data?.full_name ?? user.user_metadata?.full_name ?? '',
    avatarUrl: data?.avatar_url ?? null,
  };
}

export async function updateFullName(fullName: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const name = fullName.trim();
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, full_name: name, updated_at: new Date().toISOString() });
  if (error) throw error;
  await supabase.auth.updateUser({ data: { full_name: name } });
}

// Email changes are confirmed by a link sent to the new address.
export async function updateEmail(email: string) {
  const { error } = await supabase.auth.updateUser({ email: email.trim() });
  if (error) throw error;
}

export async function pickAndUploadAvatar(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Allow photo access to change your picture.');

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]?.base64) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const path = `${user.id}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, decode(res.assets[0].base64), { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  // The timestamp makes the image refresh after a change.
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, avatar_url: url, updated_at: new Date().toISOString() });
  if (error) throw error;
  return url;
}

export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw error;
  await supabase.auth.signOut();
}