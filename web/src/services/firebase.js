import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Public web config for the same Firebase project the mobile app uses.
// These values identify the project; access is controlled by Firebase Auth and rules.
const firebaseConfig = {
  apiKey: 'AIzaSyA4YE9aBP7adElrVM_OgZ_6Ffrd8dx4P0A',
  authDomain: 'abay-clone-project-36721.firebaseapp.com',
  projectId: 'abay-clone-project-36721',
  storageBucket: 'abay-clone-project-36721.firebasestorage.app',
  messagingSenderId: '493277530900',
  appId: '1:493277530900:web:1ea2b0f3fea9d11eddd001',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
