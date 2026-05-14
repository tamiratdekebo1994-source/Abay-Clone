import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { COLORS } from '../utils/constants';
import { getColors } from '../utils/theme';
import { driverAPI } from '../services/api';
import { t } from '../utils/i18n';

// Auth Screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
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
import MoreScreen from '../screens/MoreScreen';

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
    if (!projectId) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await driverAPI.registerPushToken(token);
  } catch (err) {
    console.log('[Push] Registration failed:', err.message);
  }
}

function MainTabs() {
  const theme = useSelector((state) => state.settings.theme);
  const C = getColors(theme);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: COLORS.white,
          paddingTop: 6, paddingBottom: 8,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: '#E0E0E0',
          height: 64,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: COLORS.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E0E0E0' }} />
        ),
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        sceneStyle: { backgroundColor: C.background },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Trips"
        component={OrdersScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Trips',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>🚗</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Earnings',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>💲</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Notifications',
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>🔔</Text>
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'More',
          tabBarIcon: ({ focused }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>•••</Text>
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen
        name="OtpVerification"
        component={OtpVerificationScreen}
        options={{ headerShown: false }}
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
      {isAuthenticated && user?.role === 'STORE' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🏪</Text>
          <Text style={{ color: COLORS.white, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>Store Account</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            This app is for Fetno drivers.{'\n'}Use the web dashboard for store access.
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
          {/* DRIVER who hasn't completed registration yet → force registration first */}
          {user?.role === 'DRIVER' && !driver && (
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
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Wallet"
            component={WalletScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>

  );
}
