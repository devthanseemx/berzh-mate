import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SettingsState {
  saveHistory: boolean;
  setSaveHistory: (v: boolean) => void;
}

// Saved on the phone, so the choice stays after the app is closed.
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      saveHistory: true,
      setSaveHistory: (saveHistory) => set({ saveHistory }),
    }),
    {
      name: 'berzh-mate-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);