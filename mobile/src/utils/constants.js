export const API_URL = __DEV__
  ? 'http://192.168.1.100:5000/api'  // Change to your local IP
  : 'https://api.abaydriver.et/api';

export const SOCKET_URL = __DEV__
  ? 'http://192.168.1.100:5000'
  : 'https://api.abaydriver.et';

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
