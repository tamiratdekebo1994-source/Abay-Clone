import React, { useEffect } from 'react';
import { Provider, useDispatch } from 'react-redux';
import { StatusBar } from 'expo-status-bar';
import { registerRootComponent } from 'expo';
import { View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { store } from './src/store';
import { setAuthState, loadUser } from './src/store/authStore';
import { auth } from './src/services/firebase';
import AppNavigator from './src/navigation/AppNavigator';

function AuthListener() {
  const dispatch = useDispatch();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        dispatch(loadUser());
      } else {
        dispatch(setAuthState({ signedIn: false }));
      }
    });
    return unsubscribe;
  }, []);

  return null;
}

function App() {
  return (
    <Provider store={store}>
      <View style={{ flex: 1 }}>
        <StatusBar style="light" backgroundColor="#1B4332" />
        <AuthListener />
        <AppNavigator />
      </View>
    </Provider>
  );
}

registerRootComponent(App);
