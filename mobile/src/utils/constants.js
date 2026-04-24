import Constants from 'expo-constants';

// Auto-detect the dev server host from Expo's own connection info.
// When running in Expo Go, Constants.expoConfig.hostUri contains the bundler
// address (e.g. "192.168.1.50:8081"). We strip the port and use that IP so
// the app always reaches the backend on the same machine — no .env required.
const _getDevBase = () => {
  // 1. Explicit override in .env takes priority
  const envUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  if (envUrl && !envUrl.includes('192.168.1.100')) return envUrl;

  // 2. Derive from Expo bundler host (works in Expo Go on a real device)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.launchAsset?.url?.match(/^https?:\/\/([^/]+)/)?.[1] ||
    Constants.manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }

  // 3. Last resort — localhost (works on Android emulator / iOS simulator)
  return 'http://localhost:5000';
};

const _devBase = _getDevBase();

export const API_URL = __DEV__
  ? `${_devBase}/api`
  : 'https://api.fetno.et/api';

export const SOCKET_URL = __DEV__
  ? _devBase
  : 'https://api.fetno.et';

// Google Maps API key — injected at build time via app.config.js from GOOGLE_MAPS_API_KEY env var
// See: mobile/.env.example
export const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey ?? '';

// Addis Ababa default center
export const DEFAULT_MAP_REGION = {
  latitude: 9.0192,
  longitude: 38.7525,
  latitudeDelta: 0.0922,
  longitudeDelta: 0.0421,
};

export const COLORS = {
  primary: '#1B4332',      // Deep green - Ethiopian flag inspired
  primaryLight: '#2D6A4F',
  primaryLighter: '#40916C',
  accent: '#FCBF49',       // Ethiopian yellow/gold
  accentDark: '#E8A82A',
  background: '#F8F9FA',
  white: '#FFFFFF',
  black: '#1A1A1A',
  gray: '#6C757D',
  grayLight: '#E9ECEF',
  grayLighter: '#F5F5F5',
  success: '#2D6A4F',
  error: '#DC3545',
  warning: '#FCBF49',
  text: '#212529',
  textLight: '#6C757D',
  border: '#DEE2E6',
  online: '#28A745',
  offline: '#6C757D',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const ETHIOPIAN_CITIES = [
  { label: 'አዲስ አበባ (Addis Ababa)', value: 'Addis Ababa' },
  { label: 'ድሬዳዋ (Dire Dawa)', value: 'Dire Dawa' },
  { label: 'ሃዋሳ (Hawassa)', value: 'Hawassa' },
  { label: 'ባህር ዳር (Bahir Dar)', value: 'Bahir Dar' },
  { label: 'መቀሌ (Mekelle)', value: 'Mekelle' },
  { label: 'አዳማ (Adama)', value: 'Adama' },
  { label: 'ጅማ (Jimma)', value: 'Jimma' },
  { label: 'ደሴ (Dessie)', value: 'Dessie' },
  { label: 'ጎንደር (Gondar)', value: 'Gondar' },
  { label: 'ሲዳማ (Sidama)', value: 'Sidama' },
];

export const VEHICLE_TYPES = [
  { label: 'Motorcycle (ሞተር)', value: 'MOTORCYCLE' },
  { label: 'Bajaj (ባጃጅ)', value: 'BAJAJ' },
  { label: 'Car (መኪና)', value: 'CAR' },
  { label: 'Van (ቫን)', value: 'VAN' },
  { label: 'Truck (ትራክ)', value: 'TRUCK' },
];

export const PAYMENT_METHODS = [
  { label: 'Telebirr', value: 'TELEBIRR', icon: '📱' },
  { label: 'CBE Birr', value: 'CBE_BIRR', icon: '🏦' },
  { label: 'Awash Bank', value: 'AWASH_BANK', icon: '🏦' },
  { label: 'Dashen Bank', value: 'DASHEN_BANK', icon: '🏦' },
  { label: 'Cash (ጥሬ ገንዘብ)', value: 'CASH', icon: '💵' },
];

export const ORDER_STATUS_LABELS = {
  PENDING: { en: 'Pending', am: 'በመጠባበቅ ላይ', color: '#6C757D' },
  SEARCHING_DRIVER: { en: 'Finding Driver', am: 'ሾፌር በመፈለግ ላይ', color: '#FCBF49' },
  DRIVER_ASSIGNED: { en: 'Driver Assigned', am: 'ሾፌር ተመድቧል', color: '#1B4332' },
  DRIVER_AT_STORE: { en: 'Driver at Store', am: 'ሾፌር መደብሩ ደርሷል', color: '#2D6A4F' },
  PICKED_UP: { en: 'Picked Up', am: 'ተወሷል', color: '#40916C' },
  IN_TRANSIT: { en: 'On the Way', am: 'በመጓዝ ላይ', color: '#2D6A4F' },
  DELIVERED: { en: 'Delivered', am: 'ደርሷል', color: '#28A745' },
  CANCELLED: { en: 'Cancelled', am: 'ተሰርዟል', color: '#DC3545' },
  FAILED: { en: 'Failed', am: 'አልተሳካም', color: '#DC3545' },
};
