import React, { useEffect } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import { View } from 'react-native';
import { store } from './src/store';
import { loadUser } from './src/store/authStore';
import AppNavigator from './src/navigation/AppNavigator';

function AuthBootstrap() {
  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(loadUser());
  }, []);
  return null;
}

function App() {
  return (
    <Provider store={store}>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" backgroundColor="#1B4332" />
        <AuthBootstrap />
        <AppNavigator />
      </View>
    </Provider>
  );
}

registerRootComponent(App);
