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

// Layer styles are defined once, at module level. Recreating these objects on every
// render makes Mapbox reapply them, which is one cause of the flicker.
export const PLAN_ROUTE_CASING: any = { lineColor: colors.routeCasing, lineWidth: 8, lineCap: 'round', lineJoin: 'round' };
export const PLAN_ROUTE_LINE: any = { lineColor: colors.route, lineWidth: 5, lineCap: 'round', lineJoin: 'round' };
export const NAV_ROUTE_CASING: any = { lineColor: colors.navRouteCasing, lineWidth: 9, lineCap: 'round', lineJoin: 'round' };
export const NAV_ROUTE_LINE: any = { lineColor: colors.navRoute, lineWidth: 6, lineCap: 'round', lineJoin: 'round' };

export const STOP_CIRCLE: any = {
  circleRadius: 9,
  circleColor: ['case', ['==', ['get', 'visited'], 1], colors.stopVisited, colors.stop],
  circleStrokeWidth: 2,
  circleStrokeColor: colors.bg,
};

export const STOP_NUMBER: any = {
  textField: ['get', 'label'],
  textSize: 10,
  textColor: colors.bg,
  textAllowOverlap: true,
  textIgnorePlacement: true,
};

// Names sit below each stop. Mapbox hides a name when it would overlap another one.
export const STOP_NAME: any = {
  textField: ['get', 'name'],
  textSize: 12,
  textOffset: [0, 1.4],
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

export const ME_HALO: any = { circleRadius: 18, circleColor: colors.meHalo };
export const ME_DOT: any = {
  circleRadius: 7,
  circleColor: colors.me,
  circleStrokeWidth: 3,
  circleStrokeColor: '#FFFFFF',
};