import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const DAILY_LIMIT = 3000;

export type ServiceEvent = { t: number; kind: 'error' | 'info'; message: string };

const todayKey = () => new Date().toDateString();

interface UsageState {
  day: string;
  used: number;
  events: ServiceEvent[];
  spend: (credits: number) => void;
  setUsed: (n: number) => void;
  logEvent: (kind: ServiceEvent['kind'], message: string) => void;
  clearLog: () => void;
}

export const useUsage = create<UsageState>()(
  persist(
    (set, get) => ({
      day: todayKey(),
      used: 0,
      events: [],
      spend: (credits) => {
        const s = get();
        const base = s.day === todayKey() ? s.used : 0;
        set({ day: todayKey(), used: base + credits });
      },
      setUsed: (n) => set({ day: todayKey(), used: Math.max(0, Math.round(n)) }),
      logEvent: (kind, message) =>
        set((s) => ({ events: [{ t: Date.now(), kind, message }, ...s.events].slice(0, 100) })),
      clearLog: () => set({ events: [] }),
    }),
    {
      name: 'berzh-mate-usage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Credits used today. The count restarts at midnight.
export function usedFor(state: { day: string; used: number }): number {
  return state.day === todayKey() ? state.used : 0;
}

export function remainingToday(): number {
  return Math.max(0, DAILY_LIMIT - usedFor(useUsage.getState()));
}