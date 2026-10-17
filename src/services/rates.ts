import { supabase } from './auth';

export type Rate = {
  id: string;
  name: string;
  price_per_km: number;
  base_fare: number;
};

export async function listRates(): Promise<Rate[]> {
  const { data, error } = await supabase
    .from('rates')
    .select('id,name,price_per_km,base_fare')
    .order('created_at');
  if (error) throw error;
  // Postgres numeric columns come back as strings, so convert them.
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    price_per_km: Number(r.price_per_km),
    base_fare: Number(r.base_fare),
  }));
}

export async function saveRate(input: { id?: string; name: string; price_per_km: number; base_fare: number }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const row = {
    user_id: user.id,
    name: input.name.trim(),
    price_per_km: input.price_per_km,
    base_fare: input.base_fare,
  };
  const query = input.id
    ? supabase.from('rates').update(row).eq('id', input.id)
    : supabase.from('rates').insert(row);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteRate(id: string) {
  const { error } = await supabase.from('rates').delete().eq('id', id);
  if (error) throw error;
}