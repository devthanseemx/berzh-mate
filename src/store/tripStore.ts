import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { NAV } from '../config/navigation';
import { haversine, haversineMatrix, nearestIndex, pathCost, solveOrder } from '../services/geo';
import { fetchDurations, fetchRoute } from '../services/mapbox';
import { angleDiff, bearing, changedRuns, pathLength, splitAtStops } from '../services/routeTools';
import { getMyLocation } from '../services/whereAmI';
import type { LngLat, RouteInfo, Stop } from '../types';

const MOVE_HIGHLIGHT_MS = 60000; // how long ▲/▼ arrows stay after optimizing

export type OptimizeResult = {
  beforeCost: number;
  afterCost: number;
  metric: 'time' | 'distance';
} | null;

const pendingOf = (stops: Stop[]) => stops.filter((s) => s.status === 'pending');

async function resolveStart(navigating: boolean, position: LngLat | null): Promise<LngLat | null> {
  if (navigating && position) return position;
  return getMyLocation();
}

function remainingOnLeg(pos: LngLat, leg: LngLat[]) {
  const { index } = nearestIndex(pos, leg);
  return { index, remainingM: pathLength(leg.slice(index)) };
}

// Scales planned times to your average speed. Returns 1 when speed is unknown.
function speedFactor(route: RouteInfo, speedMps: number): number {
  if (speedMps < 1 || route.durationS <= 0) return 1;
  const planned = route.distanceM / route.durationS;
  return Math.min(2.5, Math.max(0.5, planned / speedMps));
}

// Clock time (ms) for each pending stop.
function computeEtas(pending: Stop[], durations: number[], factor: number, now: number) {
  const out: Record<string, number> = {};
  let acc = 0;
  pending.forEach((s, i) => {
    acc += durations[i] ?? 0;
    out[s.id] = now + acc * factor * 1000;
  });
  return out;
}

async function buildRoute(start: LngLat | null, pending: Stop[]): Promise<RouteInfo> {
  const points: LngLat[] = [...(start ? [start] : []), ...pending.map((s) => s.coord)];
  const raw = await fetchRoute(points);
  const legs = splitAtStops(raw.geometry, pending.map((s) => s.coord));
  const pad = start ? 0 : 1;
  return {
    legs,
    legDistanceM: [...Array(pad).fill(0), ...raw.legDistanceM],
    legDurationS: [...Array(pad).fill(0), ...raw.legDurationS],
    distanceM: raw.distanceM,
    durationS: raw.durationS,
  };
}

interface TripState {
  stops: Stop[];
  route: RouteInfo | null;
  position: LngLat | null;
  heading: number;
  speedMps: number;
  navigating: boolean;
  loading: boolean;
  optimizing: boolean;
  optimizeResult: OptimizeResult;
  error: string | null;

  moves: Record<string, string>; // stop id -> '▲' or '▼'
  movesStamp: number;

  lastRerouteAt: number;
  offRouteFixes: number;
  wrongWayFixes: number;
  wrongWay: boolean;
  reroutedSegments: LngLat[][];
  rerouteStamp: number;
  etas: Record<string, number>;

  addStop: (coord: LngLat, name?: string) => string;
  renameStop: (id: string, name: string) => void;
  removeStop: (id: string) => void;
  clear: () => void;
  optimize: () => Promise<void>;
  previewRoute: (opts?: { highlight?: boolean }) => Promise<void>;
  startNavigation: () => Promise<void>;
  stopNavigation: () => void;
  markArrived: () => Promise<void>;
  onLocation: (loc: LocationObject) => Promise<void>;
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      stops: [],
      route: null,
      position: null,
      heading: -1,
      speedMps: 0,
      navigating: false,
      loading: false,
      optimizing: false,
      optimizeResult: null,
      error: null,

      moves: {},
      movesStamp: 0,

      lastRerouteAt: 0,
      offRouteFixes: 0,
      wrongWayFixes: 0,
      wrongWay: false,
      reroutedSegments: [],
      rerouteStamp: 0,
      etas: {},

      addStop: (coord, name) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
          stops: [
            ...state.stops,
            { id, name: name ?? `Stop ${state.stops.length + 1}`, coord, status: 'pending' },
          ],
          route: null,
          optimizeResult: null,
        }));
        return id;
      },

      renameStop: (id, name) =>
        set((state) => ({ stops: state.stops.map((s) => (s.id === id ? { ...s, name } : s)) })),

      removeStop: (id) =>
        set((state) => ({
          stops: state.stops.filter((s) => s.id !== id),
          route: null,
          optimizeResult: null,
        })),

      clear: () =>
        set({ stops: [], route: null, error: null, optimizeResult: null, etas: {}, moves: {} }),

      // Reorders pending stops by road time, starting from your location.
      // Records which stops moved up (▲) or down (▼), and clears those marks after a minute.
      optimize: async () => {
        const before = pendingOf(get().stops);
        if (before.length < 2) {
          set({ error: 'Add at least two stops to optimize.' });
          return;
        }

        set({ optimizing: true, error: null, optimizeResult: null });
        try {
          const start = await resolveStart(get().navigating, get().position);
          if (start) set({ position: start });

          const visited = get().stops.filter((s) => s.status === 'visited');
          const fixed = start ? [] : [before[0]];
          const movable = start ? before : before.slice(1);
          const points: LngLat[] = [start ?? before[0].coord, ...movable.map((s) => s.coord)];

          const durations = await fetchDurations(points).catch(() => null);
          const metric = durations ? 'time' : 'distance';
          const m = durations ?? haversineMatrix(points);

          const order = solveOrder(m);
          const beforeCost = pathCost(m, [0, ...movable.map((_, i) => i + 1)]);
          const afterCost = pathCost(m, [0, ...order.map((i) => i + 1)]);

          const finalPending = [...fixed, ...order.map((i) => movable[i])];
          const oldIds = before.map((s) => s.id);
          const moves: Record<string, string> = {};
          finalPending.forEach((s, newIdx) => {
            const oldIdx = oldIds.indexOf(s.id);
            if (oldIdx > newIdx) moves[s.id] = '▲';
            else if (oldIdx < newIdx) moves[s.id] = '▼';
          });

          const stamp = Date.now();
          set({
            stops: [...visited, ...finalPending],
            optimizing: false,
            optimizeResult: { beforeCost, afterCost, metric },
            moves,
            movesStamp: stamp,
          });
          setTimeout(() => {
            if (get().movesStamp === stamp) set({ moves: {} });
          }, MOVE_HIGHLIGHT_MS);

          await get().previewRoute();
        } catch (e: any) {
          set({ optimizing: false, error: e.message ?? 'Optimization failed' });
        }
      },

      previewRoute: async (opts) => {
        set({ loading: true, error: null });
        try {
          const st = get();
          const start = await resolveStart(st.navigating, st.position);
          if (start) set({ position: start });

          const pending = pendingOf(get().stops);
          const pointCount = (start ? 1 : 0) + pending.length;
          if (pointCount < 2) {
            set({ loading: false, route: null, etas: {}, error: 'Add a stop and allow location to see a route.' });
            return;
          }

          const old = get().route;
          const route = await buildRoute(start, pending);
          const etas = computeEtas(pending, route.legDurationS, speedFactor(route, get().speedMps), Date.now());
          set({ route, etas, loading: false });

          if (opts?.highlight && old && get().navigating) {
            const changed = changedRuns(route.legs.flat(), old.legs, NAV.REROUTE_DIFF_M);
            if (changed.length) {
              const stamp = Date.now();
              set({ reroutedSegments: changed, rerouteStamp: stamp });
              setTimeout(() => {
                if (get().rerouteStamp === stamp) set({ reroutedSegments: [] });
              }, NAV.REROUTE_HIGHLIGHT_MS);
            }
          }
        } catch (e: any) {
          set({ loading: false, error: e.message ?? 'Routing failed' });
        }
      },

      startNavigation: async () => {
        set({
          navigating: true,
          lastRerouteAt: 0,
          offRouteFixes: 0,
          wrongWayFixes: 0,
          wrongWay: false,
          speedMps: 0,
          heading: -1,
          reroutedSegments: [],
        });
        await get().previewRoute();
      },

      stopNavigation: () =>
        set({ navigating: false, route: null, etas: {}, reroutedSegments: [], wrongWay: false }),

      // Marks the next stop visited. The next leg becomes active immediately,
      // and the updated route loads in the background.
      markArrived: async () => {
        const st = get();
        const next = pendingOf(st.stops)[0];
        if (!next) return;
        const hasMore = pendingOf(st.stops).length > 1;

        set((s) => ({
          stops: s.stops.map((x) => (x.id === next.id ? { ...x, status: 'visited' } : x)),
          route:
            st.route && st.route.legs.length > 1
              ? {
                  ...st.route,
                  legs: st.route.legs.slice(1),
                  legDistanceM: st.route.legDistanceM.slice(1),
                  legDurationS: st.route.legDurationS.slice(1),
                }
              : null,
          offRouteFixes: 0,
        }));

        if (!hasMore) {
          set({ navigating: false, route: null, etas: {}, wrongWay: false });
          return;
        }
        await get().previewRoute();
      },

      onLocation: async (loc) => {
        const st = get();
        if (!st.navigating) return;

        const pos: LngLat = [loc.coords.longitude, loc.coords.latitude];
        const rawSpeed = Math.max(0, loc.coords.speed ?? 0);
        const speedMps =
          st.speedMps === 0 ? rawSpeed : st.speedMps + NAV.SPEED_SMOOTHING * (rawSpeed - st.speedMps);
        const heading =
          loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : st.heading;

        const pending = pendingOf(st.stops);
        if (!pending.length) {
          set({ navigating: false, route: null, position: pos, etas: {} });
          return;
        }

        if (!st.route) {
          set({ position: pos, heading, speedMps });
          const now = Date.now();
          if (!st.loading && now - st.lastRerouteAt > NAV.REROUTE_COOLDOWN_MS) {
            set({ lastRerouteAt: now });
            await get().previewRoute();
          }
          return;
        }

        // 1. Arrival: close along the road AND close in a straight line.
        const target = pending[0];
        const leg0 = st.route.legs[0] ?? [];
        const along =
          leg0.length > 1
            ? remainingOnLeg(pos, leg0)
            : { index: 0, remainingM: haversine(pos, target.coord) };

        if (
          along.remainingM <= NAV.ARRIVAL_ALONG_ROUTE_M &&
          haversine(pos, target.coord) <= NAV.ARRIVAL_STRAIGHT_M
        ) {
          set({ position: pos, heading, speedMps });
          await get().markArrived();
          return;
        }

        // 2. Trim the part of the current leg you've already driven.
        const trimmed = leg0.length > 1 ? leg0.slice(along.index) : leg0;
        const legs = [trimmed, ...st.route.legs.slice(1)];

        // 3. Wrong-way check.
        let wrongWayFixes = 0;
        if (speedMps >= NAV.WRONG_WAY_MIN_SPEED_MPS && heading >= 0 && trimmed.length > 1) {
          const roadBearing = bearing(trimmed[0], trimmed[1]);
          wrongWayFixes =
            angleDiff(roadBearing, heading) > NAV.WRONG_WAY_ANGLE_DEG ? st.wrongWayFixes + 1 : 0;
        }
        const wrongWay = wrongWayFixes >= NAV.WRONG_WAY_FIXES;

        // 4. Off-route check.
        const offM = nearestIndex(pos, legs.flat()).distanceM;
        const moving = speedMps >= NAV.MIN_SPEED_FOR_ROUTE_CHECK_MPS || offM > 100;
        const offRouteFixes = moving && offM > NAV.OFF_ROUTE_M ? st.offRouteFixes + 1 : 0;

        // 5. ETAs.
        const fraction = st.route.legDistanceM[0]
          ? Math.min(1, along.remainingM / st.route.legDistanceM[0])
          : 1;
        const durations = st.route.legDurationS.map((d, i) => (i === 0 ? d * fraction : d));
        const etas = computeEtas(pending, durations, speedFactor(st.route, speedMps), Date.now());

        set({
          position: pos,
          heading,
          speedMps,
          route: { ...st.route, legs },
          wrongWay,
          wrongWayFixes,
          offRouteFixes,
          etas,
        });

        // 6. Reroute, with each cooldown respected.
        const now = Date.now();
        const sinceReroute = now - st.lastRerouteAt;
        const offRouteNow = offRouteFixes >= NAV.OFF_ROUTE_FIXES && sinceReroute > NAV.REROUTE_COOLDOWN_MS;
        const wrongWayNow = wrongWayFixes >= NAV.WRONG_WAY_FIXES && sinceReroute > NAV.WRONG_WAY_REROUTE_MS;

        if (offRouteNow || wrongWayNow) {
          set({ lastRerouteAt: now, offRouteFixes: 0, wrongWayFixes: 0 });
          await get().previewRoute({ highlight: true });
        }
      },
    }),
    {
      name: 'berzh-mate-trip',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ stops: s.stops }),
    }
  )
);