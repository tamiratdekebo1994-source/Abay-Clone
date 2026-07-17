import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSelector, useDispatch } from 'react-redux';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { COLORS, TAB_BAR_HEIGHT, TAB_BAR_BOTTOM_OFFSET } from '../utils/constants';
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

function TabIcon({ name, focused }) {
  return (
    <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
      <Ionicons name={name} size={26} color={focused ? COLORS.primary : '#6B6B70'} />
    </View>
  );
}

function FloatingGlassTabBar(props) {
  const theme = useSelector((state) => state.settings.theme);
  return (
    <View style={tabStyles.floatingWrap} pointerEvents="box-none">
      {/* Shadow lives on this outer view — overflow must stay visible here or iOS drops the shadow */}
      <View style={tabStyles.shadowWrap}>
        {/* Clipping lives on this inner view so the blur/content respect the pill shape */}
        <View style={tabStyles.pill}>
          <BlurView
            intensity={Platform.OS === 'ios' ? 60 : 90}
            tint={theme === 'dark' ? 'dark' : 'light'}
            style={tabStyles.blur}
          >
            <View
              style={[
                tabStyles.tint,
                { backgroundColor: theme === 'dark' ? 'rgba(24,24,27,0.55)' : 'rgba(255,255,255,0.55)' },
              ]}
            />
            <BottomTabBarRow {...props} />
          </BlurView>
        </View>
      </View>
    </View>
  );
}

function BottomTabBarRow({ state, descriptors, navigation }) {
  return (
    <View style={tabStyles.row}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const iconName = options.tabBarIconName
          ? options.tabBarIconName(focused)
          : 'ellipse-outline';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarLabel || route.name}
            onPress={onPress}
            activeOpacity={0.75}
            style={tabStyles.tabBtn}
          >
            <TabIcon name={iconName} focused={focused} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainTabs() {
  const theme = useSelector((state) => state.settings.theme);
  const C = getColors(theme);
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingGlassTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.white,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: C.background },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Home',
          tabBarIconName: (focused) => (focused ? 'home' : 'home-outline'),
        }}
      />
      <Tab.Screen
        name="Trips"
        component={OrdersScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Trips',
          tabBarIconName: (focused) => (focused ? 'car' : 'car-outline'),
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Earnings',
          tabBarIconName: (focused) => (focused ? 'cash' : 'cash-outline'),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'Notifications',
          tabBarIconName: (focused) => (focused ? 'notifications' : 'notifications-outline'),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          headerShown: false,
          tabBarLabel: 'More',
          tabBarIconName: (focused) => (focused ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'),
        }}
      />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  floatingWrap: {
    position: 'absolute',
    left: 20, right: 20, bottom: TAB_BAR_BOTTOM_OFFSET,
  },
  shadowWrap: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  pill: {
    flex: 1,
    borderRadius: TAB_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  blur: { flex: 1 },
  tint: { ...StyleSheet.absoluteFillObject },
  row: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: TAB_BAR_HEIGHT / 2,
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
  iconWrap: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: COLORS.accent },
});

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
  const language = useSelector((state) => state.settings.language);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      registerPushToken();
    }
  }, [isAuthenticated]);

  if (isLoading || showSplash) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.accent} style={{ transform: [{ scale: 1.6 }] }} />
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
            This app is for ET Spark drivers.{'\n'}Use the web dashboard for store access.
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
            options={{ headerShown: false, gestureEnabled: false }}
          />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{ title: t('chat', language), headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ title: t('notifications', language), headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
          />
          <Stack.Screen
            name="Orders"
            component={OrdersScreen}
            options={{ title: t('deliveryHistory', language), headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: COLORS.white }}
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
