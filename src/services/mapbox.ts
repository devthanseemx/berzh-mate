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
