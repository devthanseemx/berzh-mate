import { useTripStore } from '../store/tripStore';
import { supabase } from './auth';

export type TripRow = {
  id: string;
  name: string | null;
  vehicle: string | null;
  stop_count: number;
  visited_count: number;
  planned_distance_m: number | null;
  planned_duration_s: number | null;
  status: 'completed' | 'ended';
  started_at: string | null;
  finished_at: string;
};

// Saves the finished trip. Call this when the user ends or completes navigation.
export async function recordTrip(status: 'completed' | 'ended') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const s = useTripStore.getState();
  const names = s.stops.map((x) => x.name);
  const visited = s.stops.filter((x) => x.status === 'visited').length;

  const { error } = await supabase.from('trips').insert({
    user_id: session.user.id,
    name: names.length > 1 ? `${names[0]} → ${names[names.length - 1]}` : names[0] ?? 'Trip',
    vehicle: s.vehicle,
    stop_count: s.stops.length,
    visited_count: visited,
    stops: s.stops.map(({ name, coord, status: st }) => ({ name, coord, status: st })),
    planned_distance_m: s.tripPlan?.distanceM ?? null,
    planned_duration_s: s.tripPlan?.durationS ?? null,
    status,
    started_at: new Date(s.tripStartedAt ?? Date.now()).toISOString(),
    finished_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function listTrips(): Promise<TripRow[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('id,name,vehicle,stop_count,visited_count,planned_distance_m,planned_duration_s,status,started_at,finished_at')
    .order('finished_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as TripRow[];
}