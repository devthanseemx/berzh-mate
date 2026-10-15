import type { LngLat, RawRoute } from '../types';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN!;
const COUNTRY = 'lk'; // Sri Lanka. Change this for another country.
const UNREACHABLE = 1e9;

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  coord: LngLat | null;
  mapboxId?: string;
  placeId?: string;
};

// Turns a Mapbox route into the shape the app uses.
function toRawRoute(route: any): RawRoute {
  const legs: any[] = route.legs ?? [];
  return {
    geometry: route.geometry.coordinates as LngLat[],
    legDistanceM: legs.map((l) => l.distance),
    legDurationS: legs.map((l) => l.duration),
    distanceM: route.distance,
    durationS: route.duration,
  };
}

// Tries stricter options first, then looser ones, so one awkward stop
// can't block the whole trip. The first attempt that works is used.
export async function fetchRoute(points: LngLat[]): Promise<RawRoute> {
  if (points.length < 2) throw new Error('Need at least two points');
  if (points.length > 25) {
    throw new Error('Mapbox routes allow up to 25 points. Remove a stop to continue.');
  }

  const coords = points.map((p) => p.join(',')).join(';');
  const n = points.length;
  const base =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&continue_straight=true&access_token=${TOKEN}`;

  const attempts = [
    // 1. Snap to roads within 150 m, approach stops from the curb side.
    base +
      `&radiuses=${Array(n).fill('150').join(';')}` +
      `&approaches=${points.map((_, i) => (i === 0 ? 'unrestricted' : 'curb')).join(';')}`,
    // 2. Snap to any road, no curb rule.
    base + `&radiuses=${Array(n).fill('unlimited').join(';')}`,
    // 3. Plain request.
    base,
  ];

  let lastMessage = 'No route found';
  for (const url of attempts) {
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    const route = json.routes?.[0];
    if (res.ok && route) return toRawRoute(route);
    lastMessage = json.message ?? lastMessage;
  }

  throw new Error(`Mapbox: ${lastMessage}`);
}

export async function fetchDurations(points: LngLat[]): Promise<number[][] | null> {
  if (points.length < 2 || points.length > 25) return null;

  const coords = points.map((p) => p.join(',')).join(';');
  const url =
    `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coords}` +
    `?annotations=duration&access_token=${TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const json = await res.json();
  if (!json.durations) return null;

  return json.durations.map((row: (number | null)[]) => row.map((v) => v ?? UNREACHABLE));
}

// Name of the place at a coordinate, or null.
export async function reverseGeocode(coord: LngLat): Promise<string | null> {
  const params = new URLSearchParams({
    longitude: String(coord[0]),
    latitude: String(coord[1]),
    limit: '1',
    access_token: TOKEN,
  });
  const res = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`);
  if (!res.ok) return null;
  const json = await res.json();
  const f = json.features?.[0];
  return f?.properties?.name ?? f?.properties?.full_address ?? null;
}
