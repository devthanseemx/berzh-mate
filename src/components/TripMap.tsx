import Mapbox from '@rnmapbox/maps';
import { memo, useCallback, useMemo, type RefObject } from 'react';
import { StyleSheet } from 'react-native';
import type { LngLat, RouteInfo, RouteOptionItem, Stop } from '../types';
import {
  CANDIDATE_DOT,
  MAP_STYLES,
  ME_ARROW_STYLE,
  ME_DOT_STYLE,
  ME_HALO,
  type MapStyleKey,
  REROUTE_ARROWS,
  REROUTE_LINE,
  ROUTE_ACTIVE,
  ROUTE_CASING,
  ROUTE_UPCOMING,
  STOP_CIRCLE,
  STOP_MOVE,
  STOP_NAME,
  STOP_NAME_HIDDEN,
  STOP_NUMBER,
} from '../theme/mapStyles';

export const DEFAULT_CENTER: LngLat = [81.7, 7.71]; // Batticaloa
const NO_MOVES: Record<string, string> = {};

type Props = {
  cameraRef: RefObject<Mapbox.Camera | null>;
  styleKey: MapStyleKey;
  initialCenter?: LngLat;
  stops: Stop[];
  route: RouteInfo | null;
  routeMode: 'plan' | 'navigate';
  me: LngLat | null;
  heading?: number;
  reroutes?: LngLat[][];
  moves?: Record<string, string>;
  candidate: LngLat | null;
  showNames?: boolean;
  onPress?: (e: any) => void;
  onStopPress?: (id: string) => void;
  onRegionWillChange?: (e: any) => void;
  surfaceView?: boolean;
  alternatives?: RouteOptionItem[];
  selectedAltId?: string | null;
  onAlternativePress?: (id: string) => void;
};

const pointCollection = (c: LngLat) => ({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }],
});

function TripMapBase({
  cameraRef,
  styleKey,
  initialCenter = DEFAULT_CENTER,
  stops,
  route,
  routeMode,
  me,
  heading = -1,
  reroutes = [],
  moves = NO_MOVES,
  candidate,
  showNames = true,
  onPress,
  onStopPress,
  onRegionWillChange,
  surfaceView = true,
  alternatives = [],
  selectedAltId = null,
  onAlternativePress,
}: Props) {
  const navigating = routeMode === 'navigate';
  const cameraDefaults = useMemo(() => ({ centerCoordinate: initialCenter, zoomLevel: 15 }), [initialCenter]);

  // While navigating: the first leg is active (blue) and the rest are pink.
  // While planning: every leg is blue.
  const routeShape = useMemo(
    () =>
      route
        ? {
            type: 'FeatureCollection',
            features: route.legs
              .map((leg, i) => ({
                type: 'Feature',
                properties: { active: !navigating || i === 0 ? 1 : 0 },
                geometry: { type: 'LineString', coordinates: leg },
              }))
              .filter((f) => f.geometry.coordinates.length > 1),
          }
        : null,
    [route, navigating]
  );

  const rerouteShape = useMemo(
    () =>
      reroutes.length
        ? {
            type: 'FeatureCollection',
            features: reroutes
              .filter((l) => l.length > 1)
              .map((l) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: l } })),
          }
        : null,
    [reroutes]
  );

  const firstPendingId = useMemo(() => stops.find((s) => s.status === 'pending')?.id, [stops]);

  const stopShape = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: stops.map((s, i) => ({
        type: 'Feature',
        properties: {
          stopId: s.id,
          label: String(i + 1),
          name: s.name,
          visited: s.status === 'visited' ? 1 : 0,
          next: s.id === firstPendingId ? 1 : 0,
          move: moves[s.id] ?? '',
        },
        geometry: { type: 'Point', coordinates: s.coord },
      })),
    }),
    [stops, firstPendingId, moves]
  );

  const meShape = useMemo(
    () =>
      me
        ? {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { bearing: heading >= 0 ? heading : 0 },
                geometry: { type: 'Point', coordinates: me },
              },
            ],
          }
        : null,
    [me, heading]
  );

  // Circle while planning, triangle while navigating. Both layers exist; one is hidden.
  const meDotStyle = useMemo(
    () => ({ ...ME_DOT_STYLE, visibility: navigating ? 'none' : 'visible' }) as any,
    [navigating]
  );
  const meHaloStyle = useMemo(
    () => ({ ...ME_HALO, visibility: navigating ? 'none' : 'visible' }) as any,
    [navigating]
  );
  const meArrowStyle = useMemo(
    () => ({ ...ME_ARROW_STYLE, visibility: navigating ? 'visible' : 'none' }) as any,
    [navigating]
  );

  const candidateShape = useMemo(() => (candidate ? pointCollection(candidate) : null), [candidate]);

  const handleStopPress = useCallback(
    (e: any) => {
      const id = e?.features?.[0]?.properties?.stopId;
      if (id && onStopPress) onStopPress(id);
    },
    [onStopPress]
  );

    const altShape = useMemo(
    () =>
      navigating || alternatives.length === 0
        ? null
        : {
            type: 'FeatureCollection',
            features: alternatives
              .filter((a) => a.id !== selectedAltId && a.legs.flat().length > 1)
              .map((a) => ({
                type: 'Feature',
                properties: { altId: a.id },
                geometry: { type: 'LineString', coordinates: a.legs.flat() },
              })),
          },
    [alternatives, selectedAltId, navigating]
  );

  const handleAltPress = useCallback(
    (e: any) => {
      const id = e?.features?.[0]?.properties?.altId;
      if (id && onAlternativePress) onAlternativePress(id);
    },
    [onAlternativePress]
  );

  return (
    <Mapbox.MapView
      style={styles.map}
      styleURL={MAP_STYLES[styleKey].url}
      logoEnabled={false}
      attributionEnabled={false}
      scaleBarEnabled={false}
      surfaceView={surfaceView}
      onPress={onPress}
      onRegionWillChange={onRegionWillChange}
    >
      <Mapbox.Camera ref={cameraRef} defaultSettings={cameraDefaults} />

      {routeShape && (
        <Mapbox.ShapeSource id="route" shape={routeShape as any}>
          <Mapbox.LineLayer id="routeUpcoming" filter={['==', ['get', 'active'], 0] as any} style={ROUTE_UPCOMING} />
          <Mapbox.LineLayer id="routeCasing" filter={['==', ['get', 'active'], 1] as any} style={ROUTE_CASING} />
          <Mapbox.LineLayer id="routeActive" filter={['==', ['get', 'active'], 1] as any} style={ROUTE_ACTIVE} />
        </Mapbox.ShapeSource>
      )}

      {rerouteShape && (
        <Mapbox.ShapeSource id="reroute" shape={rerouteShape as any}>
          <Mapbox.LineLayer id="rerouteLine" style={REROUTE_LINE} />
          <Mapbox.SymbolLayer id="rerouteArrows" style={REROUTE_ARROWS} />
        </Mapbox.ShapeSource>
      )}

      <Mapbox.ShapeSource id="stops" shape={stopShape as any} onPress={handleStopPress}>
        <Mapbox.CircleLayer id="stopCircles" style={STOP_CIRCLE} />
        <Mapbox.SymbolLayer id="stopNumbers" style={STOP_NUMBER} />
        <Mapbox.SymbolLayer id="stopNames" style={showNames ? STOP_NAME : STOP_NAME_HIDDEN} />
      </Mapbox.ShapeSource>

      {candidateShape && (
        <Mapbox.ShapeSource id="candidate" shape={candidateShape as any}>
          <Mapbox.CircleLayer id="candidateDot" style={CANDIDATE_DOT} />
        </Mapbox.ShapeSource>
      )}

      {meShape && (
        <Mapbox.ShapeSource id="me" shape={meShape as any}>
          <Mapbox.CircleLayer id="meHalo" style={meHaloStyle} />
          <Mapbox.CircleLayer id="meDot" style={meDotStyle} />
          <Mapbox.SymbolLayer id="meArrow" style={meArrowStyle} />
        </Mapbox.ShapeSource>
      )}
    </Mapbox.MapView>
  );
}

export const TripMap = memo(TripMapBase);

const styles = StyleSheet.create({
  map: { flex: 1 },
});