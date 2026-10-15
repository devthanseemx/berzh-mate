import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useTripStore } from '../store/tripStore';

export const LOCATION_TASK = 'berzh-mate-location';

// Runs even when the app is in the background. The store decides what to do with each fix.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const locations = data?.locations as Location.LocationObject[] | undefined;
  if (locations?.length) {
    await useTripStore.getState().onLocation(locations[locations.length - 1]);
  }
});

export async function requestNavigationPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  // Background access is needed for screen-off navigation. Denying it still lets
  // the app work while it's open.
  await Location.requestBackgroundPermissionsAsync();
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
    // Android needs this foreground service notification to keep tracking with the screen off.
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