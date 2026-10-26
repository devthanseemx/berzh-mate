import type { LngLat } from '../types';
import { searchPlaces } from './geoapify';
import type { PlaceResult } from './mapbox';

export type SharedMapLocation = { name: string; coord: LngLat };

const GOOGLE_COORDINATES = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i;
const AT_COORDINATES = /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/;
const PAIR_COORDINATES = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;

function validGoogleHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'maps.app.goo.gl' ||
    host === 'goo.gl' ||
    host === 'maps.google.com' ||
    host === 'google.com' ||
    host.endsWith('.google.com')
  );
}

export function isGoogleMapsUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || !validGoogleHost(url.hostname)) return false;
    if (url.hostname === 'maps.app.goo.gl' || url.hostname === 'maps.google.com') return true;
    return url.pathname === '/maps' || url.pathname.startsWith('/maps/');
  } catch {
    return false;
  }
}

function parseCoordinatePair(value: string | null): LngLat | null {
  if (!value) return null;
  const match = PAIR_COORDINATES.exec(value);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  if (Math.abs(first) > 90 || Math.abs(second) > 180) return null;
  return [second, first];
}

function extractCoordinates(url: URL): LngLat | null {
  const placeCoordinates = GOOGLE_COORDINATES.exec(url.href);
  if (placeCoordinates) {
    const lat = Number(placeCoordinates[1]);
    const lon = Number(placeCoordinates[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lon, lat];
  }

  const atCoordinates = AT_COORDINATES.exec(url.href);
  if (atCoordinates) {
    const lat = Number(atCoordinates[1]);
    const lon = Number(atCoordinates[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return [lon, lat];
  }

  for (const key of ['q', 'query', 'll', 'center', 'destination', 'daddr']) {
    const coordinate = parseCoordinatePair(url.searchParams.get(key));
    if (coordinate) return coordinate;
  }

  return null;
}

function extractPlaceName(url: URL): string | null {
  const placePath = url.pathname.split('/place/')[1]?.split('/')[0];
  const query = url.searchParams.get('q') ?? url.searchParams.get('query');
  const rawName = placePath ?? (query && !parseCoordinatePair(query) ? query : null);
  if (!rawName) return null;

  try {
    const name = decodeURIComponent(rawName.replace(/\+/g, ' ')).trim();
    return name || null;
  } catch {
    return rawName.trim() || null;
  }
}

async function resolveShortLink(rawUrl: string): Promise<URL> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(rawUrl, { method: 'GET', redirect: 'follow', signal: controller.signal });
    const resolved = new URL(response.url || rawUrl);
    if (!response.ok) throw new Error(`Google Maps link could not be opened (${response.status}).`);
    if (!isGoogleMapsUrl(resolved.toString())) throw new Error('This link does not lead to a Google Maps location.');
    return resolved;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The Google Maps link took too long to resolve. Check your connection and try again.');
    }
    if (error instanceof Error && error.message.includes('does not lead')) throw error;
    throw new Error('Could not open this Google Maps link. Check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveGoogleMapsLocation(rawUrl: string): Promise<SharedMapLocation> {
  const trimmedUrl = rawUrl.trim();
  if (!isGoogleMapsUrl(trimmedUrl)) {
    throw new Error('Paste a valid Google Maps sharing link.');
  }

  let url = new URL(trimmedUrl);
  let coord = extractCoordinates(url);
  let name = extractPlaceName(url);

  if (!coord) {
    url = await resolveShortLink(trimmedUrl);
    coord = extractCoordinates(url);
    name = extractPlaceName(url) ?? name;
  }

  if (coord) return { name: name ?? 'Shared Google Maps location', coord };

  if (name) {
    const results = await searchPlaces(name);
    const match = results.find((place): place is PlaceResult & { coord: LngLat } => !!place.coord);
    if (match?.coord) return { name: match.name || name, coord: match.coord };
  }

  throw new Error('Could not find a place in this Google Maps link. Try sharing a place pin or a link with coordinates.');
}
