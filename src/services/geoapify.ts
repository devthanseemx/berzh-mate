import { remainingToday, useUsage } from '../store/usage';
import type { LngLat, RawRoute, RouteStep } from '../types';
import type { PlaceResult } from './mapbox';

const KEY = process.env.EXPO_PUBLIC_GEOAPIFY_KEY!;
const API = 'https://api.geoapify.com/v1';
const UNREACHABLE = 1e9;

// The route service accepts up to 100 km per request. Pieces are kept well under that.
const MAX_PIECE_M = 80000;

export type VehicleKey = 'car' | 'three_wheeler' | 'motorcycle' | 'bicycle' | 'walk';
export type Pref = 'balanced' | 'short' | 'less_maneuvers' | 'no_highways' | 'detour';

export const VEHICLES: Record<VehicleKey, { label: string; mode: string; prefs: Pref[]; note?: string }> = {
  car: { label: 'Car', mode: 'drive', prefs: ['balanced', 'short', 'less_maneuvers', 'no_highways'] },
  three_wheeler: {
    label: 'Three-wheeler',
    mode: 'drive',
    prefs: ['balanced', 'short', 'no_highways'],
    note: 'Routed on car roads with highways avoided. Check local rules before relying on a route.',
  },
  motorcycle: { label: 'Motorcycle', mode: 'motorcycle', prefs: ['balanced', 'short'] },
  bicycle: { label: 'Bicycle', mode: 'bicycle', prefs: ['balanced', 'short'] },
  walk: { label: 'Walking', mode: 'walk', prefs: ['balanced', 'short'] },
};

const PREF_LABEL: Record<Pref, string> = {
  balanced: 'Fastest',
  short: 'Shortest',
  less_maneuvers: 'Fewer turns',
  no_highways: 'No highways',
  detour: 'Alternative path',
};

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

export function routeParams(vehicle: VehicleKey, pref: Pref) {
  return { mode: VEHICLES[vehicle].mode, extra: prefParams(pref) };
}

const searchCache = new Map<string, PlaceResult[]>();

function requireKey() {
  if (!KEY) throw new Error('Missing EXPO_PUBLIC_GEOAPIFY_KEY in .env');
}

// Turns a failed response into a clear message.
function explain(status: number, body: string, label: string): string {
  const lower = body.toLowerCase();
  const creditsWords = /credit|quota|limit/.test(lower);
  if (status === 401 || status === 403) {
    return 'The route service rejected the key. Check EXPO_PUBLIC_GEOAPIFY_KEY in .env.';
  }
  if (status === 402 || (status === 429 && creditsWords)) {
    return "Today's route and search credits are used up. They reset at midnight.";
  }
  if (status === 429) {
    return 'Too many requests at once. Wait a few seconds and try again.';
  }
  if (status >= 500) {
    return 'The route service is down right now. Try again in a little while.';
  }
  return body || `${label} failed (${status}).`;
}

// Every request goes through here. It checks the daily allowance first,
// charges credits only on success, and logs problems for the Usage screen.
async function call(label: string, cost: number, url: string, init?: RequestInit): Promise<any> {
  requireKey();
  const log = (msg: string) => useUsage.getState().logEvent('error', `${label}: ${msg}`);

  if (remainingToday() < cost) {
    const msg = "Today's route and search credits are used up. They reset at midnight.";
    log(msg);
    throw new Error(msg);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    const msg = 'No connection to the route service. Check your internet.';
    log(msg);
    throw new Error(msg);
  }

  if (!res.ok) {
    const body = String(await res.json().then((j: any) => j.message ?? j.error ?? '').catch(() => ''));
    const msg = explain(res.status, body, label);
    log(msg);
    throw new Error(msg);
  }

  useUsage.getState().spend(cost);
  return res.json();
}

export async function searchPlaces(text: string, near?: LngLat | null): Promise<PlaceResult[]> {
  const q = text.trim();
  if (q.length < 2) return [];

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    text: q,
    lang: 'en',
    limit: '8',
    format: 'json',
    filter: 'countrycode:lk',
    apiKey: KEY,
  });
  if (near) params.set('bias', `proximity:${near[0]},${near[1]}`);

  const json = await call('Search', 1, `${API}/geocode/autocomplete?${params}`);

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

// One request for exactly two points.
async function singlePiece(a: LngLat, b: LngLat, mode: string, extra: Record<string, string>): Promise<RawRoute> {
  const params = new URLSearchParams({
    waypoints: `${a[1]},${a[0]}|${b[1]},${b[0]}`,
    mode,
    intermediate_waypoint_mode: 'stopover',
    details: 'instruction_details',
    lang: 'en',
    format: 'geojson',
    apiKey: KEY,
    ...extra,
  });

  const json = await call('Route', 1, `${API}/routing?${params}`);

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

// Straight-line distance in meters between two points.
function distanceM(a: LngLat, b: LngLat): number {
  const r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r;
  const dLng = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

// Points spaced along a long leg, so each piece is short enough for one request.
// Short legs return just their two endpoints.
function splitLeg(a: LngLat, b: LngLat): LngLat[] {
  const pieces = Math.max(1, Math.ceil(distanceM(a, b) / MAX_PIECE_M));
  const points: LngLat[] = [];
  for (let i = 0; i <= pieces; i++) {
    const t = i / pieces;
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  // The first and last points are the real stops, not interpolated ones.
  points[0] = a;
  points[points.length - 1] = b;
  return points;
}

// Joins the pieces of one stop-to-stop leg into one line.
function joinPieces(pieces: RawRoute[]): RawRoute {
  const geometry: LngLat[] = [];
  for (const p of pieces) {
    for (const c of p.geometry) {
      const last = geometry[geometry.length - 1];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) geometry.push(c);
    }
  }
  return {
    geometry,
    steps: pieces.flatMap((p) => p.steps ?? []),
    legDistanceM: [],
    legDurationS: [],
    distanceM: pieces.reduce((sum, p) => sum + p.distanceM, 0),
    durationS: pieces.reduce((sum, p) => sum + p.durationS, 0),
  };
}

// Route through all stops in order. Long legs are split into pieces, requested one by one,
// and joined. Credits are charged per piece, as the service charges.
export async function fetchRoute(
  points: LngLat[],
  mode: string,
  extra: Record<string, string> = {}
): Promise<RawRoute> {
  if (points.length < 2) throw new Error('Need at least two points');

  const legCount = points.length - 1;
  const legs: RawRoute[] = [];

  for (let i = 0; i < legCount; i++) {
    const anchors = splitLeg(points[i], points[i + 1]);
    const pieces: RawRoute[] = [];

    for (let j = 0; j < anchors.length - 1; j++) {
      try {
        pieces.push(await singlePiece(anchors[j], anchors[j + 1], mode, extra));
      } catch (e: any) {
        const hint =
          mode === 'drive' ? '' : ' Move that stop closer to a road you can use, or choose another vehicle.';
        throw new Error(`Leg ${i + 1} of ${legCount} could not be routed: ${e.message}.${hint}`);
      }
    }

    const joined = joinPieces(pieces);
    legs.push({
      ...joined,
      legDistanceM: [joined.distanceM],
      legDurationS: [joined.durationS],
    });
  }

  // One line per stop-to-stop leg, so the app can match legs to stops.
  return {
    geometry: legs.flatMap((l) => l.geometry),
    legs: legs.map((l) => l.geometry),
    steps: legs.flatMap((l) => l.steps ?? []),
    legDistanceM: legs.map((l) => l.distanceM),
    legDurationS: legs.map((l) => l.durationS),
    distanceM: legs.reduce((sum, l) => sum + l.distanceM, 0),
    durationS: legs.reduce((sum, l) => sum + l.durationS, 0),
  };
}

// Routes for the chosen vehicle, one per preference, duplicates removed, fastest first.
// If every option fails, the error explains why.
// A point that bends a leg to one side of its midpoint, by about a quarter of the leg length.
function detourPoint(a: LngLat, b: LngLat, side: 1 | -1): LngLat {
  const midLat = (a[1] + b[1]) / 2;
  const k = Math.cos((midLat * Math.PI) / 180); // corrects longitude for latitude
  const dx = (b[0] - a[0]) * k;
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1e-9;
  const offset = 0.25 * len;
  const px = (-dy / len) * side * offset;
  const py = (dx / len) * side * offset;
  return [(a[0] + b[0]) / 2 + px / k, (a[1] + b[1]) / 2 + py];
}

// A route that goes through a bend point on each leg. Used when every option returns the same road.
export async function fetchDetourRoute(points: LngLat[], mode: string): Promise<RawRoute> {
  const legs: RawRoute[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const via = detourPoint(a, b, i % 2 === 0 ? 1 : -1);
    const r = await fetchRoute([a, via, b], mode, {});
    legs.push({
      geometry: r.geometry,
      legs: [r.geometry],
      steps: r.steps ?? [],
      legDistanceM: [r.distanceM],
      legDurationS: [r.durationS],
      distanceM: r.distanceM,
      durationS: r.durationS,
    });
  }

  return {
    geometry: legs.flatMap((l) => l.geometry),
    legs: legs.map((l) => l.geometry),
    steps: legs.flatMap((l) => l.steps ?? []),
    legDistanceM: legs.map((l) => l.distanceM),
    legDurationS: legs.map((l) => l.durationS),
    distanceM: legs.reduce((sum, l) => sum + l.distanceM, 0),
    durationS: legs.reduce((sum, l) => sum + l.durationS, 0),
  };
}

// Routes for the chosen vehicle, one per preference, duplicates removed, fastest first.
export async function fetchAlternatives(points: LngLat[], vehicle: VehicleKey) {
  const prefs = VEHICLES[vehicle].prefs;
  const settled = await Promise.allSettled(
    prefs.map((p) => {
      const { mode, extra } = routeParams(vehicle, p);
      return fetchRoute(points, mode, extra);
    })
  );

  const found: { id: Pref; label: string; raw: RawRoute }[] = [];
  const errors: string[] = [];

  const same = (a: RawRoute, b: RawRoute) =>
    Math.abs(a.distanceM - b.distanceM) / Math.max(1, a.distanceM) < 0.03 &&
    Math.abs(a.durationS - b.durationS) / Math.max(1, a.durationS) < 0.05;
  const isNew = (raw: RawRoute) => !found.some((f) => same(f.raw, raw));

  settled.forEach((s, i) => {
    if (s.status === 'rejected') {
      errors.push(s.reason?.message ?? 'Route failed.');
      return;
    }
    const raw = s.value;
    if (raw.geometry.length < 2 || raw.durationS <= 0) return;
    if (isNew(raw)) found.push({ id: prefs[i], label: PREF_LABEL[prefs[i]], raw });
  });

  // Walking and cycling have only one route type, so the options often return the same road.
  // If so, add a path that bends around each leg.
  if (found.length < 2 && (vehicle === 'walk' || vehicle === 'bicycle')) {
    try {
      const detour = await fetchDetourRoute(points, VEHICLES[vehicle].mode);
      if (detour.geometry.length > 1 && detour.durationS > 0 && isNew(detour)) {
        found.push({ id: 'detour', label: PREF_LABEL.detour, raw: detour });
      }
    } catch {
      // The alternative is optional, so the main route stays visible.
    }
  }

  if (!found.length) {
    throw new Error(errors[0] ?? 'No route found for this vehicle.');
  }

  return found.sort((a, b) => a.raw.durationS - b.raw.durationS);
}

// Travel times between all points, used for stop ordering. Costs max(n, n) × min(n, 10) credits.
// Returns null on any failure, and the app falls back to straight-line distance.
export async function fetchDurations(points: LngLat[]): Promise<number[][] | null> {
  const n = points.length;
  if (!KEY || n < 2 || n * n > 1000) return null;

  const body = {
    mode: 'drive',
    sources: points.map((p) => ({ location: p })),
    targets: points.map((p) => ({ location: p })),
  };

  try {
    const json = await call('Optimize', n * Math.min(n, 10), `${API}/routematrix?apiKey=${KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!json.sources_to_targets) return null;
    return json.sources_to_targets.map((row: any[]) =>
      row.map((cell) => cell?.time ?? UNREACHABLE)
    );
  } catch {
    return null;
  }
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

  try {
    const json = await call('Place name', 1, `${API}/geocode/reverse?${params}`);
    const r = json.results?.[0];
    return r?.name ?? r?.address_line1 ?? r?.formatted ?? null;
  } catch {
    return null;
  }
}