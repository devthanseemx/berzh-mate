import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { haversine, haversineMatrix, nearestIndex, pathCost, solveOrder } from '../services/geo';
import { fetchDurations, fetchRoute } from '../services/mapbox';
import { getMyLocation } from '../services/whereAmI';
import type { LngLat, RouteInfo, Stop } from '../types';

const ARRIVAL_M = 60;
const OFF_ROUTE_M = 60;
const REROUTE_COOLDOWN_MS = 20000;

export type OptimizeResult = {
  beforeCost: number;
  afterCost: number;
  metric: 'time' | 'distance';
} | null;

const pendingOf = (stops: Stop[]) => stops.filter((s) => s.status === 'pending');

// During navigation, use the live GPS fix. Otherwise ask for a fresh position.
async function resolveStart(navigating: boolean, position: LngLat | null): Promise<LngLat | null> {
  if (navigating && position) return position;
  return getMyLocation();
}

interface TripState {
  stops: Stop[];
  route: RouteInfo | null;
  position: LngLat | null;
  navigating: boolean;
  loading: boolean;
  optimizing: boolean;
  optimizeResult: OptimizeResult;
  error: string | null;
  lastRerouteAt: number;

  addStop: (coord: LngLat, name?: string) => string;
  renameStop: (id: string, name: string) => void;
  removeStop: (id: string) => void;
  clear: () => void;
  optimize: () => Promise<void>;
  previewRoute: () => Promise<void>;
  startNavigation: () => Promise<void>;
  stopNavigation: () => void;
  onLocation: (loc: LocationObject) => Promise<void>;
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      stops: [],
      route: null,
      position: null,
      navigating: false,
      loading: false,
      optimizing: false,
      optimizeResult: null,
      error: null,
      lastRerouteAt: 0,

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
        set((state) => ({
          stops: state.stops.map((s) => (s.id === id ? { ...s, name } : s)),
        })),

      removeStop: (id) =>
        set((state) => ({
          stops: state.stops.filter((s) => s.id !== id),
          route: null,
          optimizeResult: null,
        })),

      clear: () => set({ stops: [], route: null, error: null, optimizeResult: null }),

      // Reorders pending stops by road travel time, starting from your location.
      optimize: async () => {
        if (pendingOf(get().stops).length < 2) {
          set({ error: 'Add at least two stops to optimize.' });
          return;
        }

        set({ optimizing: true, error: null, optimizeResult: null });
        try {
          const start = await resolveStart(get().navigating, get().position);
          if (start && !get().navigating) set({ position: start });

          const { stops } = get();
          const visited = stops.filter((s) => s.status === 'visited');
          const pending = pendingOf(stops);

          // Without a location, the first pending stop stays first.
          const fixed = start ? [] : [pending[0]];
          const movable = start ? pending : pending.slice(1);
          const points: LngLat[] = [start ?? pending[0].coord, ...movable.map((s) => s.coord)];

          const durations = await fetchDurations(points).catch(() => null);
          const metric = durations ? 'time' : 'distance';
          const m = durations ?? haversineMatrix(points);

          const order = solveOrder(m);
          const beforeCost = pathCost(m, [0, ...movable.map((_, i) => i + 1)]);
          const afterCost = pathCost(m, [0, ...order.map((i) => i + 1)]);

          set({
            stops: [...visited, ...fixed, ...order.map((i) => movable[i])],
            optimizing: false,
            optimizeResult: { beforeCost, afterCost, metric },
          });
          await get().previewRoute();
        } catch (e: any) {
          set({ optimizing: false, error: e.message ?? 'Optimization failed' });
        }
      },

      // Draws the route from your location through all pending stops, in order.
      previewRoute: async () => {
        set({ loading: true, error: null });
        try {
          const start = await resolveStart(get().navigating, get().position);
          if (start && !get().navigating) set({ position: start });

          const pending = pendingOf(get().stops);
          const points: LngLat[] = [...(start ? [start] : []), ...pending.map((s) => s.coord)];
          if (points.length < 2) {
            set({ loading: false, route: null, error: 'Add a stop and allow location to see a route.' });
            return;
          }

          const route = await fetchRoute(points);
          set({ route, loading: false });
        } catch (e: any) {
          set({ loading: false, error: e.message ?? 'Routing failed' });
        }
      },

      startNavigation: async () => {
        set({ navigating: true, lastRerouteAt: 0 });
        await get().previewRoute();
      },

      stopNavigation: () => set({ navigating: false, route: null }),

      onLocation: async (loc) => {
        if (!get().navigating) return;

        const pos: LngLat = [loc.coords.longitude, loc.coords.latitude];
        let { stops, route, lastRerouteAt } = get();

        let pending = pendingOf(stops);
        if (pending.length && haversine(pos, pending[0].coord) < ARRIVAL_M) {
          const reached = pending[0].id;
          stops = stops.map((s) => (s.id === reached ? { ...s, status: 'visited' } : s));
          pending = pendingOf(stops);
          route = null;
          set({ stops });
        }

        if (!pending.length) {
          set({ navigating: false, route: null, position: pos });
          return;
        }

        let needReroute = !route;
        if (route && route.geometry.length) {
          const { index, distanceM } = nearestIndex(pos, route.geometry);
          if (distanceM > OFF_ROUTE_M) {
            needReroute = true;
          } else {
            route = { ...route, geometry: route.geometry.slice(index) };
          }
        }

        set({ position: pos, route });

        const cooldownOk = Date.now() - lastRerouteAt > REROUTE_COOLDOWN_MS;
        if (needReroute && (!route || cooldownOk)) {
          set({ lastRerouteAt: Date.now() });
          await get().previewRoute();
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