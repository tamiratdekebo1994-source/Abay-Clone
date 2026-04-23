import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
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
import NotificationsScreen from '../screens/NotificationsScreen';
import OrdersScreen from '../screens/OrdersScreen';
import ReviewScreen from '../screens/ReviewScreen';
import HelpSupportScreen from '../screens/HelpSupportScreen';
import OrderDetailScreen from '../screens/OrderDetailScreen';

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

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
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
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: { backgroundColor: COLORS.primary, paddingBottom: 4, height: 60, borderTopWidth: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Fetno | Fetno',
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
  const { isAuthenticated, isLoading, driver, user } = useSelector((state) => state.auth);

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
        <Text style={{ color: COLORS.white, fontSize: 32, fontWeight: '900' }}>Fetno</Text>
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated && user?.role !== 'DRIVER' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🚗</Text>
          <Text style={{ color: COLORS.white, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>Drivers Only</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            This app is for Fetno drivers.{'\n'}Use the web dashboard for admin & store access.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 32, backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 }}
            onPress={() => dispatch(require('../store/authStore').logout())}
          >
            <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 16 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : isAuthenticated ? (
        <Stack.Navigator>
          {/* If driver role but hasn't registered yet, show registration */}
          {user?.role === 'DRIVER' && driver === null && (
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
            options={{ title: t('chat'), headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: t('notifications'), headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
          />
          <Stack.Screen
            name="Orders"
            component={OrdersScreen}
            options={{ title: t('deliveryHistory'), headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
          />
          <Stack.Screen
            name="Review"
            component={ReviewScreen}
            options={{ title: '⭐ Rate Delivery', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
          />
          <Stack.Screen
            name="HelpSupport"
            component={HelpSupportScreen}
            options={{ title: 'Help & Support / እርዳታ', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
          />
          <Stack.Screen
            name="OrderDetail"
            component={OrderDetailScreen}
            options={{ title: 'Order Details', headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
          />
        </Stack.Navigator>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>

  );
}
