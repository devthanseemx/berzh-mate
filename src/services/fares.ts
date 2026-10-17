import type { LngLat } from '../types';
import { supabase } from './auth';

export type FareTripRow = {
  id: string;
  rate_name: string;
  price_per_km: number;
  base_fare: number;
  distance_m: number;
  duration_s: number;
  fare: number;
  started_at: string;
  ended_at: string;
};

export type FareTrip = FareTripRow & { path: LngLat[] };

// Keeps the saved route small: at most 300 points.
function downsample(path: LngLat[], max = 300): LngLat[] {
  if (path.length <= max) return path;
  const out: LngLat[] = [];
  const step = (path.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(path[Math.round(i * step)]);
  return out;
}

const toRow = (r: any): FareTripRow => ({
  ...r,
  price_per_km: Number(r.price_per_km),
  base_fare: Number(r.base_fare),
  distance_m: Number(r.distance_m),
  duration_s: Number(r.duration_s),
  fare: Number(r.fare),
});

export async function saveFareTrip(t: {
  rate: { name: string; pricePerKm: number; baseFare: number };
  distanceM: number;
  durationS: number;
  fare: number;
  startedAt: number;
  endedAt: number;
  path: LngLat[];
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { error } = await supabase.from('fare_trips').insert({
    user_id: user.id,
    rate_name: t.rate.name,
    price_per_km: t.rate.pricePerKm,
    base_fare: t.rate.baseFare,
    distance_m: t.distanceM,
    duration_s: t.durationS,
    fare: t.fare,
    started_at: new Date(t.startedAt).toISOString(),
    ended_at: new Date(t.endedAt).toISOString(),
    path: downsample(t.path),
  });
  if (error) throw error;
}

export async function listFareTrips(): Promise<FareTripRow[]> {
  const { data, error } = await supabase
    .from('fare_trips')
    .select('id,rate_name,price_per_km,base_fare,distance_m,duration_s,fare,started_at,ended_at')
    .order('ended_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map(toRow);
}

export async function getFareTrip(id: string): Promise<FareTrip> {
  const { data, error } = await supabase.from('fare_trips').select('*').eq('id', id).single();
  if (error) throw error;
  return { ...toRow(data), path: (data.path ?? []) as LngLat[] };
}