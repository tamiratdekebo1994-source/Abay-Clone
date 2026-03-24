/**
 * Background Location Service for Abay Driver
 * Tracks driver location even when the app is backgrounded
 * Uses Expo Location's background task
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';

const LOCATION_TASK = 'abay-driver-background-location';
const LOCATION_UPDATE_INTERVAL = 5000;   // 5 seconds
const LOCATION_UPDATE_DISTANCE = 10;     // 10 meters

let apiBaseUrl = 'http://localhost:5000/api';

// ── Background Task Definition ────────────────────────────────────────────────
// Must be defined at top level (not inside components)
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[Location Task] Error:', error.message);
    return;
  }

  if (data) {
    const { locations } = data;
    const location = locations[0];

    if (!location) return;

    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) return;

      await fetch(`${apiBaseUrl}/driver/location`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        }),
      });
    } catch (err) {
      // Fail silently — location will be updated on next interval
    }
  }
});

// ── Public API ─────────────────────────────────────────────────────────────────

export const startBackgroundTracking = async (baseUrl) => {
  if (baseUrl) apiBaseUrl = baseUrl;

  // Request background permissions
  const { status: foreground } = await Location.requestForegroundPermissionsAsync();
  if (foreground !== 'granted') {
    throw new Error('Foreground location permission not granted');
  }

  const { status: background } = await Location.requestBackgroundPermissionsAsync();
  if (background !== 'granted') {
    console.warn('[Location] Background permission not granted — foreground only');
    return false;
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (!isRegistered) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_UPDATE_INTERVAL,
      distanceInterval: LOCATION_UPDATE_DISTANCE,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Abay Driver',
        notificationBody: 'Your location is being shared for active delivery',
        notificationColor: '#1B4332',
      },
    });
  }

  return true;
};

export const stopBackgroundTracking = async () => {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
  if (isRegistered) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
};

export const isBackgroundTrackingActive = () => {
  return TaskManager.isTaskRegisteredAsync(LOCATION_TASK);
};

export const getCurrentLocation = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy,
    speed: location.coords.speed,
    heading: location.coords.heading,
  };
};
