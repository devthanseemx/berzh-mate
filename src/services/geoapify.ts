import type { LngLat, RawRoute, RouteStep } from '../types';
import type { PlaceResult } from './mapbox';

const KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY!;
const API = 'https://api.geoapify.com/v1';
const UNREACHABLE = 1e9;

export type VehicleKey = 'car' | 'three_wheeler' | 'motorcycle' | 'bicycle' | 'walk';

// A route preference. Each vehicle supports only some of these.
export type Pref = 'balanced' | 'short' | 'less_maneuvers' | 'no_highways';

export const VEHICLES: Record<VehicleKey, { label: string; mode: string; prefs: Pref[]; note?: string }> = {
  car: {
    label: 'Car',
    mode: 'drive',
    prefs: ['balanced', 'short', 'less_maneuvers', 'no_highways'],
  },
  three_wheeler: {
    label: 'Three-wheeler',
    mode: 'drive',
    prefs: ['balanced', 'short', 'no_highways'],
    note: 'Routed on car roads with highways avoided. Check local rules before relying on a route.',
  },
  motorcycle: {
    label: 'Motorcycle',
    mode: 'motorcycle',
    prefs: ['balanced', 'short'],
  },
  bicycle: {
    label: 'Bicycle',
    mode: 'bicycle',
    prefs: ['balanced', 'short'],
  },
  walk: {
    label: 'Walking',
    mode: 'walk',
    prefs: ['balanced', 'short'],
  },
};

const PREF_LABEL: Record<Pref, string> = {
  balanced: 'Fastest',
  short: 'Shortest',
  less_maneuvers: 'Fewer turns',
  no_highways: 'No highways',
};

// Extra request parameters for each preference.
function prefParams(pref: Pref): Record<string, string> {
  switch (pref) {
    case 'short':
      return { type: 'short' };
    case 'less_maneuvers':
      return { type: 'less_maneuvers' };
    case 'no_highways':
      return { type: 'balanced', avoid: 'highways' };
    default:
      return { type: 'balanced' };
  }
}

// Travel mode and parameters for one vehicle and preference.
export function routeParams(vehicle: VehicleKey, pref: Pref) {
  return { mode: VEHICLES[vehicle].mode, extra: prefParams(pref) };
}

const searchCache = new Map<string, PlaceResult[]>();

function requireKey() {
  if (!KEY) throw new Error('Missing EXPO_PUBLIC_GEOAPIFY_KEY in .env');
}

async function readError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json.message ?? json.error ?? `Geoapify error ${res.status}`;
  } catch {
    return `Geoapify error ${res.status}`;
  }
}

export async function searchPlaces(text: string, near?: LngLat | null): Promise<PlaceResult[]> {
  const q = text.trim();
  if (q.length < 3) return [];
  requireKey();

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    text: q,
    lang: 'en',
    limit: '8',
    format: 'json',
    filter: 'countrycode:lk', // Sri Lanka. Change for another country.
    apiKey: KEY,
  });
  if (near) params.set('bias', `proximity:${near[0]},${near[1]}`);

  const res = await fetch(`${API}/geocode/autocomplete?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();

  const results: PlaceResult[] = (json.results ?? [])
    .filter((r: any) => r.lat != null && r.lon != null)
    .map((r: any, i: number) => ({
      id: r.place_id ?? `${r.lat},${r.lon},${i}`,
      name: r.name ?? r.address_line1 ?? r.formatted ?? q,
      address: r.address_line2 ?? r.formatted ?? '',
      coord: [r.lon, r.lat] as LngLat,
    }));

  if (searchCache.size > 100) searchCache.clear();
  searchCache.set(cacheKey, results);
  return results;
}

// One route through the points, with turn-by-turn instructions.
export async function fetchRoute(
  points: LngLat[],
  mode: string,
  extra: Record<string, string> = {}
): Promise<RawRoute> {
  if (points.length < 2) throw new Error('Need at least two points');
  requireKey();

  const waypoints = points.map((p) => `${p[1]},${p[0]}`).join('|');
  const params = new URLSearchParams({
    waypoints,
    mode,
    intermediate_waypoint_mode: 'stopover',
    details: 'instruction_details',
    lang: 'en',
    format: 'geojson',
    apiKey: KEY,
    ...extra,
  });

  const res = await fetch(`${API}/routing?${params}`);
  if (!res.ok) throw new Error(await readError(res));
  const json = await res.json();

  const feature = json.features?.[0];
  if (!feature) throw new Error('No route found');

  const lines: LngLat[][] =
    feature.geometry.type === 'MultiLineString'
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];
  const legMeta: any[] = feature.properties?.legs ?? [];

  const steps: RouteStep[] = [];
  legMeta.forEach((leg, li) => {
    const line = lines[li] ?? [];
    (leg.steps ?? []).forEach((st: any) => {
      const text = st.instruction?.text;
      const coord = line[st.from_index];
      if (text && coord) steps.push({ text, coord });
    });
  });

  return {
    geometry: lines.flat(),
    legs: lines,
    steps,
    legDistanceM: legMeta.map((l) => l.distance),
    legDurationS: legMeta.map((l) => l.time),
    distanceM: feature.properties?.distance ?? 0,
    durationS: feature.properties?.time ?? 0,
  };
}

// Routes for the chosen vehicle, one per preference, with duplicates removed.
// Sorted fastest first. Routes that fail for this vehicle are left out.
export async function fetchAlternatives(points: LngLat[], vehicle: VehicleKey) {
  const prefs = VEHICLES[vehicle].prefs;
  const settled = await Promise.allSettled(
    prefs.map((p) => {
      const { mode, extra } = routeParams(vehicle, p);
      return fetchRoute(points, mode, extra);
    })
  );

  const found: { id: Pref; label: string; raw: RawRoute }[] = [];
  settled.forEach((s, i) => {
    if (s.status !== 'fulfilled') return;
    const raw = s.value;
    if (raw.geometry.length < 2 || raw.durationS <= 0) return;

    // Treat routes within 3% distance and 5% time as the same route.
    const duplicate = found.some(
      (f) =>
        Math.abs(f.raw.distanceM - raw.distanceM) / Math.max(1, f.raw.distanceM) < 0.03 &&
        Math.abs(f.raw.durationS - raw.durationS) / f.raw.durationS < 0.05
    );
    if (!duplicate) found.push({ id: prefs[i], label: PREF_LABEL[prefs[i]], raw });
  });

  return found.sort((a, b) => a.raw.durationS - b.raw.durationS);
}

export async function fetchDurations(points: LngLat[]): Promise<number[][] | null> {
  if (!KEY || points.length < 2 || points.length * points.length > 1000) return null;

  const body = {
    mode: 'drive',
    sources: points.map((p) => ({ location: p })),
    targets: points.map((p) => ({ location: p })),
  };

  const res = await fetch(`${API}/routematrix?apiKey=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;

  const json = await res.json();
  if (!json.sources_to_targets) return null;

  return json.sources_to_targets.map((row: any[]) =>
    row.map((cell) => cell?.time ?? UNREACHABLE)
  );
}

export async function reverseGeocode(coord: LngLat): Promise<string | null> {
  if (!KEY) return null;

  const params = new URLSearchParams({
    lat: String(coord[1]),
    lon: String(coord[0]),
    lang: 'en',
    format: 'json',
    apiKey: KEY,
  });
  const res = await fetch(`${API}/geocode/reverse?${params}`);
  if (!res.ok) return null;

  const json = await res.json();
  const r = json.results?.[0];
  return r?.name ?? r?.address_line1 ?? r?.formatted ?? null;
}