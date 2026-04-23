import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authStore';
import settingsReducer from './settingsStore';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    settings: settingsReducer,
  },
});
