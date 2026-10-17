import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { useMeter } from '../store/meter';

export const METER_TASK = 'berzh-meter-location';

// Runs while the screen is off. Each fix goes to the meter store.
TaskManager.defineTask(METER_TASK, async ({ data, error }: any) => {
  if (error) return;
  const locations = data?.locations as Location.LocationObject[] | undefined;
  if (!locations?.length) return;
  for (const loc of locations) useMeter.getState().onFix(loc);
});

export async function startMeterTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(METER_TASK)) return;
  await Location.startLocationUpdatesAsync(METER_TASK, {
    accuracy: Location.Accuracy.High,
    timeInterval: 2000,
    distanceInterval: 3,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    foregroundService: {
      notificationTitle: 'Berzh Meter is running',
      notificationBody: 'Measuring your trip distance',
      notificationColor: '#F59E0B',
    },
  });
}

export async function stopMeterTracking() {
  if (await Location.hasStartedLocationUpdatesAsync(METER_TASK)) {
    await Location.stopLocationUpdatesAsync(METER_TASK);
  }
}