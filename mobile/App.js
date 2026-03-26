import React from 'react';
import { Provider } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';

const sentryDsn = Constants.expoConfig?.extra?.sentryDsn;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: __DEV__ ? 'development' : 'production',
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enableNative: true,
  });
}

export default Sentry.wrap(function App() {
  return (
    <Provider store={store}>
      <StatusBar style="light" backgroundColor="#1B4332" />
      <AppNavigator />
    </Provider>
  );
});
