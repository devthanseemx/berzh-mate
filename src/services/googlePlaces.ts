import type { LngLat } from '../types';
import type { PlaceResult } from './mapbox';

const KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY!;
const BASE = 'https://places.googleapis.com/v1';

// A session token groups the keystrokes of one search with the final selection.
// Google bills the whole session as one request, which keeps autocomplete cheap.
export function newSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Reads Google's error message so it can be shown on screen.
async function googleError(res: Response): Promise<Error> {
  try {
    const json = await res.json();
    return new Error(json.error?.message ?? `Google error ${res.status}`);
  } catch {
    return new Error(`Google error ${res.status}`);
  }
}

// Suggestions as the user types, biased toward nearby places.
export async function autocomplete(
  input: string,
  sessionToken: string,
  near?: LngLat | null
): Promise<PlaceResult[]> {
  const q = input.trim();
  if (q.length < 2) return [];
  if (!KEY) throw new Error('Missing EXPO_PUBLIC_GOOGLE_PLACES_KEY in .env');

  const body: Record<string, unknown> = {
    input: q,
    sessionToken,
    languageCode: 'en',
    includedRegionCodes: ['lk'], // Sri Lanka. Change for another country.
  };
  if (near) {
    body.locationBias = {
      circle: { center: { latitude: near[1], longitude: near[0] }, radius: 30000 },
    };
  }

  const res = await fetch(`${BASE}/places:autocomplete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await googleError(res);

  const json = await res.json();
  return (json.suggestions ?? [])
    .filter((s: any) => s.placePrediction) // skips query suggestions, keeps real places
    .map((s: any) => {
      const p = s.placePrediction;
      return {
        id: p.placeId,
        name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? 'Place',
        address: p.structuredFormat?.secondaryText?.text ?? '',
        coord: null,
        placeId: p.placeId,
      } as PlaceResult;
    });
}

// Coordinates and full name for the chosen suggestion. This call ends the session.
export async function placeDetails(placeId: string, sessionToken: string): Promise<PlaceResult> {
  const res = await fetch(
    `${BASE}/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(sessionToken)}`,
    {
      headers: {
        'X-Goog-Api-Key': KEY,
        'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
      },
    }
  );
  if (!res.ok) throw await googleError(res);

  const json = await res.json();
  return {
    id: placeId,
    name: json.displayName?.text ?? 'Selected place',
    address: json.formattedAddress ?? '',
    coord: [json.location.longitude, json.location.latitude] as LngLat,
    placeId,
  };
}