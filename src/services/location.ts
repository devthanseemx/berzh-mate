import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useTripStore } from '../store/tripStore';
import '../services/meterLocation';

export const LOCATION_TASK = 'berzh-mate-location';

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const locations = data?.locations as Location.LocationObject[] | undefined;
  if (locations?.length) {
    await useTripStore.getState().onLocation(locations[locations.length - 1]);
  }
});

// Only asks for permission when it hasn't been granted yet, so starting navigation is quick.
export async function requestNavigationPermissions(): Promise<boolean> {
  let fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== 'granted') fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;

  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status !== 'granted' && bg.canAskAgain) await Location.requestBackgroundPermissionsAsync();
  return true;
}

export async function startTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 2000,
    distanceInterval: 5,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: 'Berzh Mate is navigating',
      notificationBody: 'Tracking your route',
      notificationColor: '#2DD4BF',
    },
  });
}

export async function stopTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}