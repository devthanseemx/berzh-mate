import * as Location from 'expo-location';
import type { LngLat } from '../types';

// Returns your current position, or null if location is off or denied.
export async function getMyLocation(): Promise<LngLat | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  try {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return [loc.coords.longitude, loc.coords.latitude];
  } catch {
    const last = await Location.getLastKnownPositionAsync();
    return last ? [last.coords.longitude, last.coords.latitude] : null;
  }
}