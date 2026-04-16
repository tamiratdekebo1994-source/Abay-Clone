import React from 'react';
import { Provider } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';

const sentryDsn = Constants.expoConfig?.extra?.sentryDsn;

function App() {
  return (
    <Provider store={store}>
      <StatusBar style="light" backgroundColor="#1B4332" />
      <AppNavigator />
    </Provider>
  );
}

if (sentryDsn) {
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: sentryDsn,
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: __DEV__ ? 1.0 : 0.2,
      enableNative: true,
    });
    module.exports = { default: Sentry.wrap(App) };
  } catch (e) {
    // Sentry native module unavailable (e.g. Expo Go)
  }
}

export default App;
