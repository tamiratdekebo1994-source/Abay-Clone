import { initializeApp, getApps, getApp } from 'firebase/app';
import Constants from 'expo-constants';

const cfg = Constants.expoConfig?.extra?.firebase || {};

const firebaseConfig = {
  apiKey:            cfg.apiKey            || 'AIzaSyA4YE9aBP7adElrVM_OgZ_6Ffrd8dx4P0A',
  authDomain:        cfg.authDomain        || 'abay-clone-project-36721.firebaseapp.com',
  projectId:         cfg.projectId         || 'abay-clone-project-36721',
  storageBucket:     cfg.storageBucket     || 'abay-clone-project-36721.firebasestorage.app',
  messagingSenderId: cfg.messagingSenderId || '493277530900',
  appId:             cfg.appId             || '1:493277530900:web:1ea2b0f3fea9d11eddd001',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const FIREBASE_API_KEY = firebaseConfig.apiKey;
