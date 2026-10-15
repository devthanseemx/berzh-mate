import type { LngLat, RouteInfo } from '../types';

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
