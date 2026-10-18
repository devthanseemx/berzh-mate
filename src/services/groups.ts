import { supabase } from './auth';

export type GroupRow = {
  id: string;
  name: string;
  status: 'active' | 'finished';
  owner_id: string;
  created_at: string;
  finished_at: string | null;
};
export type MemberRow = { id: string; email: string; name: string | null; user_id: string | null; sharing: boolean };
export type ExpenseRow = {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  paid_by: string;
  created_by: string;
  shares: string[];
};

// Converts database errors into messages the user can read.
function clean(e: any): Error {
  const m: string = e?.message ?? 'Something went wrong.';
  if (/duplicate key/i.test(m)) return new Error('That person is already on this trip.');
  return new Error(m);
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw clean(error);
  return data;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function claimInvites() {
  await rpc('claim_invites', {}).catch(() => {});
}

export async function listGroups(): Promise<GroupRow[]> {
  const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
  if (error) throw clean(error);
  return (data ?? []) as GroupRow[];
}

export const createGroup = (name: string) => rpc('create_group', { p_name: name }) as Promise<string>;

export async function getGroup(id: string) {
  const [g, m, e, s] = await Promise.all([
    supabase.from('groups').select('*').eq('id', id).single(),
    supabase.from('group_members').select('*').eq('group_id', id).order('created_at'),
    supabase.from('group_expenses').select('*').eq('group_id', id).order('created_at'),
    supabase.from('group_expense_shares').select('expense_id, member_id').eq('group_id', id),
  ]);
  for (const r of [g, m, e, s]) if (r.error) throw clean(r.error);

  const shareMap = new Map<string, string[]>();
  (s.data ?? []).forEach((x: any) => {
    shareMap.set(x.expense_id, [...(shareMap.get(x.expense_id) ?? []), x.member_id]);
  });

  const expenses: ExpenseRow[] = (e.data ?? []).map((x: any) => ({
    ...x,
    quantity: Number(x.quantity),
    unit_price: Number(x.unit_price),
    total: Number(x.total),
    shares: shareMap.get(x.id) ?? [],
  }));

  return { group: g.data as GroupRow, members: (m.data ?? []) as MemberRow[], expenses };
}

export const addMember = (group: string, email: string, name: string) =>
  rpc('add_member', { p_group: group, p_email: email, p_name: name });

export const removeMember = (member: string) => rpc('remove_member', { p_member: member });

export const addExpense = (input: {
  group: string;
  name: string;
  quantity: number;
  unitPrice: number;
  paidBy: string;
  sharedBy: string[];
}) =>
  rpc('add_expense', {
    p_group: input.group,
    p_name: input.name,
    p_quantity: input.quantity,
    p_unit_price: input.unitPrice,
    p_paid_by: input.paidBy,
    p_shared: input.sharedBy,
  });

export const deleteExpense = (expense: string) => rpc('delete_expense', { p_expense: expense });

export const setSharing = (group: string, on: boolean) => rpc('set_sharing', { p_group: group, p_on: on });

export const sendLocation = (group: string, lat: number, lng: number) =>
  rpc('send_location', { p_group: group, p_lat: lat, p_lng: lng });

export const endGroup = (group: string) => rpc('end_group', { p_group: group });

export async function sendSummary(group: string) {
  const { data, error } = await supabase.functions.invoke('send-summary', { body: { group_id: group } });
  if (error) {
    const body = await (error as any).context?.json?.().catch(() => null);
    throw new Error(body?.error ?? 'Could not send summaries. Check the function logs in Supabase.');
  }
  return data as { sent: number; failed: string[]; lastError?: string };
}