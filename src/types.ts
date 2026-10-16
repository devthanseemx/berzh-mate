export type LngLat = [number, number]; // [longitude, latitude]

export type Stop = {
  id: string;
  name: string;
  coord: LngLat;
  status: 'pending' | 'visited';
};

export type RouteStep = {
  text: string;
  coord: LngLat;
};

// Raw result from the routing API.
export type RawRoute = {
  geometry: LngLat[];
  legs?: LngLat[][];
  steps?: RouteStep[];
  legDistanceM: number[];
  legDurationS: number[];
  distanceM: number;
  durationS: number;
};

// The route the app uses: one line per stop-to-stop leg, in visiting order.
export type RouteInfo = {
  legs: LngLat[][];
  steps: RouteStep[];
  legDistanceM: number[];
  legDurationS: number[];
  distanceM: number;
  durationS: number;
};

// A route option shown to the user, with its label and ID.
export type RouteOptionItem = RouteInfo & {
  id: string;
  label: string;
};