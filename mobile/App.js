import React from 'react';
import { Provider } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';

function App() {
  return (
    <Provider store={store}>
      <StatusBar style="light" backgroundColor="#1B4332" />
      <AppNavigator />
    </Provider>
  );
}

registerRootComponent(App);
