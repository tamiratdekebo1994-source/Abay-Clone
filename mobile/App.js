import React from 'react';
import { Provider } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <View style={{ flex: 1 }}>
          <StatusBar style="light" backgroundColor="#1B4332" />
          <AppNavigator />
        </View>
      </Provider>
    </GestureHandlerRootView>
  );
}

registerRootComponent(App);
