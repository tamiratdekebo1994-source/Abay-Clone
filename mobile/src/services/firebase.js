import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const cfg = Constants.expoConfig?.extra?.firebase || {};

const firebaseConfig = {
  apiKey:            cfg.apiKey            || '',
  authDomain:        cfg.authDomain        || '',
  projectId:         cfg.projectId         || '',
  storageBucket:     cfg.storageBucket     || '',
  messagingSenderId: cfg.messagingSenderId || '',
  appId:             cfg.appId             || '',
};

export const firebaseApp = getApps().length
  ? getApps()[0]
  : initializeApp(firebaseConfig);

export const auth = initializeAuth(firebaseApp, {
  persistence: getReactNativePersistence(AsyncStorage),
});
