import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LngLat } from '../types';

// A place the user bookmarked for later: home, work, a regular stop…
export type SavedPlace = {
  id: string;
  name: string;
  address: string;
  coord: LngLat;
  category?: string | null;
  savedAt: number;
};

type SavedPlacesState = {
  places: SavedPlace[];
  save: (p: { name: string; address?: string; coord: LngLat; category?: string | null }) => SavedPlace;
  remove: (id: string) => void;
  isSaved: (coord: LngLat) => boolean;
};

export const HOME_PLACE_CATEGORIES = ['Home', 'Office', 'Places to visit'] as const;

const near = (a: LngLat, b: LngLat) => Math.abs(a[0] - b[0]) < 1e-5 && Math.abs(a[1] - b[1]) < 1e-5;

export const useSavedPlaces = create<SavedPlacesState>()(
  persist(
    (set, get) => ({
      places: [],

      save: (p) => {
        const existing = get().places.find((x) => near(x.coord, p.coord));
        if (existing) {
          const updated = {
            ...existing,
            name: p.name.trim(),
            address: p.address ?? existing.address,
            category: p.category?.trim() || null,
          };
          set((s) => ({ places: s.places.map((x) => (x.id === existing.id ? updated : x)) }));
          return updated;
        }
        const place: SavedPlace = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: p.name.trim(),
          address: p.address ?? '',
          coord: p.coord,
          category: p.category?.trim() || null,
          savedAt: Date.now(),
        };
        set((s) => ({ places: [place, ...s.places] }));
        return place;
      },

      remove: (id) => set((s) => ({ places: s.places.filter((p) => p.id !== id) })),

      isSaved: (coord) => get().places.some((p) => near(p.coord, coord)),
    }),
    {
      name: 'berzh-mate-saved-places',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ places: s.places }),
    }
  )
);
