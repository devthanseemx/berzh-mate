import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_STYLE, type MapStyleKey } from '../theme/mapStyles';

interface MapPrefs {
  styleKey: MapStyleKey;
  setStyleKey: (key: MapStyleKey) => void;
}

export const useMapPrefs = create<MapPrefs>()(
  persist(
    (set) => ({
      styleKey: DEFAULT_STYLE,
      setStyleKey: (styleKey) => set({ styleKey }),
    }),
    {
      name: 'berzh-mate-map',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);