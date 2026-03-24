import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import * as Notifications from 'expo-notifications';
import { loadUser } from '../store/authStore';
import { COLORS } from '../utils/constants';
import { driverAPI } from '../services/api';
import { t } from '../utils/i18n';

// Auth Screens
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import OtpVerificationScreen from '../screens/auth/OtpVerificationScreen';
import CompleteProfileScreen from '../screens/auth/CompleteProfileScreen';

// Driver Registration
import DriverRegistrationScreen from '../screens/driver/DriverRegistrationScreen';

// Main Screens
import HomeScreen from '../screens/HomeScreen';
import EarningsScreen from '../screens/EarningsScreen';
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ActiveDeliveryScreen from '../screens/ActiveDeliveryScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Setup push notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerPushToken() {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await driverAPI.registerPushToken(token);
  } catch (err) {
    console.log('[Push] Registration failed:', err.message);
  }
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.gray,
        tabBarStyle: { paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Abay Driver | አባይ ሾፌር',
          tabBarLabel: t('appName').split(' ')[0],
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 22 }}>{focused ? '🏠' : '🏡'}</Text>,
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          title: t('earnings'),
          tabBarLabel: t('earnings'),
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 22 }}>{focused ? '💰' : '💵'}</Text>,
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          title: t('wallet'),
          tabBarLabel: t('wallet'),
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 22 }}>{focused ? '👝' : '💼'}</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('profile'),
          tabBarLabel: t('profile'),
          tabBarIcon: ({ focused }) => <Text style={{ fontSize: 22 }}>{focused ? '👤' : '👥'}</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen
        name="OtpVerification"
        component={OtpVerificationScreen}
        options={{ headerShown: true, title: t('verify'), headerStyle: { backgroundColor: COLORS.white }, headerTintColor: COLORS.primary }}
      />
      <Stack.Screen
        name="CompleteProfile"
        component={CompleteProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverRegistration"
        component={DriverRegistrationScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading, driver } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(loadUser());
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary }}>
        <Text style={{ color: COLORS.accent, fontSize: 40, fontWeight: '800' }}>አ</Text>
        <Text style={{ color: COLORS.white, fontSize: 16, marginTop: 8, fontWeight: '600' }}>Abay Driver</Text>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <Stack.Navigator>
          {/* If driver hasn't registered yet, show registration */}
          {driver === null && (
            <Stack.Screen
              name="DriverRegistration"
              component={DriverRegistrationScreen}
              options={{ headerShown: false }}
            />
          )}
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="ActiveDelivery"
            component={ActiveDeliveryScreen}
            options={{ title: t('activeDelivery'), headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={({ route }) => ({
              title: t('chat'),
              headerStyle: { backgroundColor: COLORS.primary },
              headerTintColor: COLORS.white,
            })}
          />
        </Stack.Navigator>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
