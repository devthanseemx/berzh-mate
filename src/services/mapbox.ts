import type { LngLat, RouteInfo } from '../types';

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN!;
const COUNTRY = 'lk'; // Sri Lanka. Change this for another country.
const UNREACHABLE = 1e9;

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  coord: LngLat | null; // null until the place is retrieved
  mapboxId?: string;
};

// A session groups the keystrokes of one search with the final selection,
// so Mapbox bills one search rather than every keystroke.
export function newSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function fetchRoute(points: LngLat[]): Promise<RouteInfo> {
  if (points.length < 2) throw new Error('Need at least two points');
  const coords = points.map((p) => p.join(',')).join(';');
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
    `?geometries=geojson&overview=full&access_token=${TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Directions request failed (${res.status})`);

  const json = await res.json();
  const route = json.routes?.[0];
  if (!route) throw new Error('No route found');

  return {
    geometry: route.geometry.coordinates as LngLat[],
    distanceM: route.distance,
    durationS: route.duration,
  };
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

// Place search. Business and local names come from Search Box; the geocoder is the fallback.
export async function searchPlaces(
  query: string,
  sessionToken: string,
  near?: LngLat
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    language: 'en',
    country: COUNTRY,
    limit: '8',
    session_token: sessionToken,
    access_token: TOKEN,
  });
  params.set('types', 'poi,address,street,neighborhood,locality,place');
  if (near) params.set('proximity', near.join(','));

  const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const json = await res.json();

  const suggestions: PlaceResult[] = (json.suggestions ?? []).map((s: any) => ({
    id: s.mapbox_id,
    name: s.name,
    address: s.full_address ?? s.place_formatted ?? '',
    coord: null,
    mapboxId: s.mapbox_id,
  }));

  if (suggestions.length) return suggestions;
  return geocodeFallback(q, near);
}

// The geocoder tolerates looser spelling and finds smaller places than Search Box sometimes does.
async function geocodeFallback(q: string, near?: LngLat): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    q,
    country: COUNTRY,
    language: 'en',
    limit: '8',
    autocomplete: 'true',
    access_token: TOKEN,
  });
  if (near) params.set('proximity', near.join(','));

  const res = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`);
  if (!res.ok) return [];
  const json = await res.json();

  return (json.features ?? []).map((f: any) => ({
    id: f.properties?.mapbox_id ?? f.geometry.coordinates.join(','),
    name: f.properties?.name ?? q,
    address: f.properties?.full_address ?? f.properties?.place_formatted ?? '',
    coord: f.geometry.coordinates as LngLat,
  }));
}

// Gets the coordinates of a Search Box suggestion once the user picks it.
export async function retrievePlace(mapboxId: string, sessionToken: string): Promise<PlaceResult> {
  const params = new URLSearchParams({ session_token: sessionToken, access_token: TOKEN });
  const res = await fetch(
    `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}?${params}`
  );
  if (!res.ok) throw new Error(`Could not open that place (${res.status})`);
  const json = await res.json();
  const f = json.features?.[0];
  if (!f) throw new Error('That place has no location');

  return {
    id: mapboxId,
    name: f.properties?.name ?? 'Selected place',
    address: f.properties?.full_address ?? f.properties?.place_formatted ?? '',
    coord: f.geometry.coordinates as LngLat,
    mapboxId,
  };
}