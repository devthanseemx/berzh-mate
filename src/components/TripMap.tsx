import Mapbox from '@rnmapbox/maps';
import { memo, useCallback, useMemo, type RefObject } from 'react';
import { StyleSheet } from 'react-native';
import {
  CANDIDATE_DOT,
  MAP_STYLES,
  ME_DOT,
  ME_HALO,
  NAV_ROUTE_CASING,
  NAV_ROUTE_LINE,
  PLAN_ROUTE_CASING,
  PLAN_ROUTE_LINE,
  STOP_CIRCLE,
  STOP_NAME,
  STOP_NAME_HIDDEN,
  STOP_NUMBER,
  type MapStyleKey,
} from '../theme/mapStyles';
import type { LngLat, RouteInfo, Stop } from '../types';

export const DEFAULT_CENTER: LngLat = [81.7, 7.71]; // Batticaloa

type Props = {
    cameraRef: RefObject<Mapbox.Camera | null>;
    styleKey: MapStyleKey;
    initialCenter?: LngLat;
    stops: Stop[];
    route: RouteInfo | null;
    routeMode: 'plan' | 'navigate';
    me: LngLat | null;
    candidate: LngLat | null;
    showNames?: boolean;
    onPress?: (e: any) => void;
    onStopPress?: (id: string) => void;
    onRegionWillChange?: (e: any) => void;
};

const pointShape = (coord: LngLat) => ({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: coord } }],
});

function TripMapBase({
    cameraRef,
    styleKey,
    initialCenter = DEFAULT_CENTER,
    stops,
    route,
    routeMode,
    me,
    candidate,
    showNames = true,
    onPress,
    onStopPress,
    onRegionWillChange,
}: Props) {
    const cameraDefaults = useMemo(
        () => ({ centerCoordinate: initialCenter, zoomLevel: 15 }),
        [initialCenter]
    );

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
                },
                geometry: { type: 'Point', coordinates: s.coord },
            })),
        }),
        [stops]
    );

    const routeShape = useMemo(
        () =>
            route && route.geometry.length > 1
                ? {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: route.geometry },
                }
                : null,
        [route]
    );

    const meShape = useMemo(() => (me ? pointShape(me) : null), [me]);
    const candidateShape = useMemo(() => (candidate ? pointShape(candidate) : null), [candidate]);

    const handleStopPress = useCallback(
        (e: any) => {
            const id = e?.features?.[0]?.properties?.stopId;
            if (id && onStopPress) onStopPress(id);
        },
        [onStopPress]
    );

    const navigating = routeMode === 'navigate';

    return (
        <Mapbox.MapView
            style={styles.map}
            styleURL={MAP_STYLES[styleKey].url}
            logoEnabled={false}
            attributionEnabled={false}
            scaleBarEnabled={false}
            onPress={onPress}
            onRegionWillChange={onRegionWillChange}
        >
            <Mapbox.Camera ref={cameraRef} defaultSettings={cameraDefaults} />

            {routeShape && (
                <Mapbox.ShapeSource id="route" shape={routeShape as any}>
                    <Mapbox.LineLayer id="routeCasing" style={navigating ? NAV_ROUTE_CASING : PLAN_ROUTE_CASING} />
                    <Mapbox.LineLayer id="routeLine" style={navigating ? NAV_ROUTE_LINE : PLAN_ROUTE_LINE} />
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

            {/* Your own position dot. Its color is set here, so it's easy to change. */}
            {meShape && (
                <Mapbox.ShapeSource id="me" shape={meShape as any}>
                    <Mapbox.CircleLayer id="meHalo" style={ME_HALO} />
                    <Mapbox.CircleLayer id="meDot" style={ME_DOT} />
                </Mapbox.ShapeSource>
            )}
        </Mapbox.MapView>
    );
}

export const TripMap = memo(TripMapBase);

const styles = StyleSheet.create({
    map: { flex: 1 },
});