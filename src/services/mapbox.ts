import type { LngLat } from '../types';

export type PlaceResult = {
  id: string;
  name: string;
  address: string;
  coord: LngLat | null;
  mapboxId?: string;
  placeId?: string;
};
