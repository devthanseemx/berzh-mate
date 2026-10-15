export type LngLat = [number, number]; // [longitude, latitude]

export type Stop = {
  id: string;
  name: string;
  coord: LngLat;
  status: 'pending' | 'visited';
};

// Raw Directions API result.
export type RawRoute = {
  geometry: LngLat[];
  legDistanceM: number[];
  legDurationS: number[];
  distanceM: number;
  durationS: number;
};

// One polyline per stop-to-stop leg, in visiting order.
export type RouteInfo = {
  legs: LngLat[][];
  legDistanceM: number[];
  legDurationS: number[];
  distanceM: number;
  durationS: number;
};