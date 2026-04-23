import React from 'react';
import { Provider } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import { View } from 'react-native';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';

function App() {
  return (
    <Provider store={store}>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" backgroundColor="#1B4332" />
        <AppNavigator />
      </View>
    </Provider>
  );
}

registerRootComponent(App);
