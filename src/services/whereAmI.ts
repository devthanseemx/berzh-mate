import * as Location from 'expo-location';
import type { LngLat } from '../types';

async function granted(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === 'granted') return true;
  const req = await Location.requestForegroundPermissionsAsync();
  return req.status === 'granted';
}

// Waits for a fresh GPS fix. Use this when accuracy matters more than speed.
export async function getMyLocation(): Promise<LngLat | null> {
  if (!(await granted())) return null;
  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return [loc.coords.longitude, loc.coords.latitude];
  } catch {
    const last = await Location.getLastKnownPositionAsync();
    return last ? [last.coords.longitude, last.coords.latitude] : null;
  }
}

// Returns immediately with the last known position. It waits for GPS only when there's none.
export async function getQuickLocation(): Promise<LngLat | null> {
  if (!(await granted())) return null;
  const last = await Location.getLastKnownPositionAsync();
  if (last) return [last.coords.longitude, last.coords.latitude];
  return getMyLocation();
}