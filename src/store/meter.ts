import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LocationObject } from 'expo-location';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { haversine } from '../services/geo';
import type { LngLat } from '../types';

export type RateSnapshot = { name: string; pricePerKm: number; baseFare: number };

export type MeterRun = {
  status: 'idle' | 'running' | 'done';
  rate: RateSnapshot | null;
  startedAt: number | null;
  endedAt: number | null;
  distanceM: number;
  last: LngLat | null;
  path: LngLat[];
};

const EMPTY_RUN: MeterRun = {
  status: 'idle',
  rate: null,
  startedAt: null,
  endedAt: null,
  distanceM: 0,
  last: null,
  path: [],
};

const MAX_ACCURACY_M = 30; // ignore fixes less precise than this
const JITTER_M = 3;        // movement smaller than this is noise
const SLOW_M = 10;         // when moving slower than 1 m/s, ignore movement under this
const MAX_JUMP_M = 300;    // a larger jump is treated as a GPS error and not counted

interface MeterState {
  activeRateId: string | null;
  run: MeterRun;
  setActiveRateId: (id: string | null) => void;
  startTrip: (rate: RateSnapshot) => void;
  onFix: (loc: LocationObject) => void;
  stopTrip: () => MeterRun | null;
  reset: () => void;
}

export const useMeter = create<MeterState>()(
  persist(
    (set, get) => ({
      activeRateId: null,
      run: EMPTY_RUN,

      setActiveRateId: (activeRateId) => set({ activeRateId }),

      startTrip: (rate) =>
        set({ run: { ...EMPTY_RUN, status: 'running', rate, startedAt: Date.now() } }),

      onFix: (loc) => {
        const { run } = get();
        if (run.status !== 'running') return;
        if ((loc.coords.accuracy ?? 0) > MAX_ACCURACY_M) return;

        const pos: LngLat = [loc.coords.longitude, loc.coords.latitude];
        if (!run.last) {
          set({ run: { ...run, last: pos, path: [pos] } });
          return;
        }

        const d = haversine(run.last, pos);
        const speed = loc.coords.speed ?? -1;
        const slow = speed >= 0 && speed < 1;
        if (d < JITTER_M) return;
        if (slow && d < SLOW_M) return;

        const added = d <= MAX_JUMP_M ? d : 0;
        set({
          run: {
            ...run,
            distanceM: run.distanceM + added,
            last: pos,
            path: [...run.path, pos],
          },
        });
      },

      stopTrip: () => {
        const { run } = get();
        if (run.status !== 'running') return null;
        const done: MeterRun = { ...run, status: 'done', endedAt: Date.now() };
        set({ run: done });
        return done;
      },

      reset: () => set({ run: EMPTY_RUN }),
    }),
    {
      name: 'berzh-mate-meter',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ activeRateId: s.activeRateId, run: s.run }),
    }
  )
);