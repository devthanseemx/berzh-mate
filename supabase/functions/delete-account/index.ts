import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identify the caller from their own token, never from the request body.
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json({ error: 'Not signed in' }, 401);

  const admin = createClient(url, service);
  await admin.storage.from('avatars').remove([`${user.id}/avatar.jpg`]); // ignore errors
  const { error } = await admin.auth.admin.deleteUser(user.id); // profile and trips are removed by cascade
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
});