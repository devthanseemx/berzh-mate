import { colors } from './colors';

export const MAP_STYLES = {
  streets: { label: 'Streets', url: 'mapbox://styles/mapbox/streets-v12' },
  night: { label: 'Night', url: 'mapbox://styles/mapbox/navigation-night-v1' },
  satellite: { label: 'Satellite', url: 'mapbox://styles/mapbox/satellite-streets-v12' },
  outdoors: { label: 'Outdoors', url: 'mapbox://styles/mapbox/outdoors-v12' },
  light: { label: 'Light', url: 'mapbox://styles/mapbox/light-v11' },
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;
export const DEFAULT_STYLE: MapStyleKey = 'streets';

// Route
export const ROUTE_CASING: any = {
  lineColor: colors.routeActiveCasing,
  lineWidth: 10,
  lineCap: 'round',
  lineJoin: 'round',
};
export const ROUTE_ACTIVE: any = {
  lineColor: colors.routeActive,
  lineWidth: 6,
  lineCap: 'round',
  lineJoin: 'round',
};
export const ROUTE_UPCOMING: any = {
  lineColor: colors.routeUpcoming,
  lineWidth: 5,
  lineOpacity: 0.9,
  lineCap: 'round',
  lineJoin: 'round',
};

// Rerouted roads
export const REROUTE_LINE: any = {
  lineColor: colors.routeReroute,
  lineWidth: 7,
  lineCap: 'round',
  lineJoin: 'round',
};
export const REROUTE_ARROWS: any = {
  symbolPlacement: 'line',
  symbolSpacing: 90,
  textField: '→',
  textSize: 16,
  textColor: colors.routeReroute,
  textHaloColor: colors.bg,
  textHaloWidth: 2,
  textKeepUpright: false,
  textAllowOverlap: true,
};

// Stops. The next stop is larger and white with a teal ring.
export const STOP_CIRCLE: any = {
  circleRadius: ['case', ['==', ['get', 'next'], 1], 12, 9],
  circleColor: [
    'case',
    ['==', ['get', 'visited'], 1], colors.stopVisited,
    ['==', ['get', 'next'], 1], colors.stopNext,
    colors.stop,
  ],
  circleStrokeWidth: ['case', ['==', ['get', 'next'], 1], 3, 2],
  circleStrokeColor: ['case', ['==', ['get', 'next'], 1], colors.stopNextRing, colors.bg],
};

// Stop number, above the stop.
export const STOP_NUMBER: any = {
  textField: ['get', 'label'],
  textSize: 12,
  textOffset: [0, -1.3],
  textAnchor: 'bottom',
  textColor: colors.text,
  textHaloColor: colors.bg,
  textHaloWidth: 2,
  textAllowOverlap: true,
  textIgnorePlacement: true,
};

// Move arrow, above the number. Only shows for stops that moved during optimization.
export const STOP_MOVE: any = {
  textField: ['get', 'move'],
  textSize: 18,
  textOffset: [0, -2.7],
  textAnchor: 'bottom',
  textColor: ['case', ['==', ['get', 'move'], '▲'], colors.up, colors.down],
  textHaloColor: colors.bg,
  textHaloWidth: 2,
  textAllowOverlap: true,
  textIgnorePlacement: true,
};

// Stop name, below the stop.
export const STOP_NAME: any = {
  textField: ['get', 'name'],
  textSize: 12,
  textOffset: [0, 1.5],
  textAnchor: 'top',
  textColor: colors.text,
  textHaloColor: colors.bg,
  textHaloWidth: 1.5,
  textMaxWidth: 8,
};
export const STOP_NAME_HIDDEN: any = { ...STOP_NAME, textSize: 0 };

export const CANDIDATE_DOT: any = {
  circleRadius: 9,
  circleColor: colors.candidate,
  circleStrokeWidth: 3,
  circleStrokeColor: colors.bg,
};

// Your position. The dot is shown while planning; the arrow while navigating.
export const ME_HALO: any = { circleRadius: 16, circleColor: colors.meHalo };
export const ME_DOT_STYLE: any = {
  circleRadius: 8,
  circleColor: colors.me,
  circleStrokeWidth: 3,
  circleStrokeColor: '#FFFFFF',
};
export const ME_ARROW_STYLE: any = {
  textField: '▲',
  textSize: 28,
  textColor: colors.me,
  textHaloColor: '#FFFFFF',
  textHaloWidth: 2,
  textRotate: ['get', 'bearing'],
  textRotationAlignment: 'viewport',
  textAllowOverlap: true,
  textIgnorePlacement: true,
};