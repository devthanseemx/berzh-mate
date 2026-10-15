export type LngLat = [number, number]; // [longitude, latitude], the Mapbox order

export type Stop = {
  id: string;
  name: string;
  coord: LngLat;
  status: 'pending' | 'visited';
};

export type RouteInfo = {
  geometry: LngLat[];
  distanceM: number;
  durationS: number;
};