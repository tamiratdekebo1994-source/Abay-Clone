import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, RefreshControl, ActivityIndicator,
  Platform, Animated, Dimensions, Modal, Linking, Easing,
} from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs } from 'firebase/firestore';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { driverAPI, orderAPI } from '../services/api';
import { updateDriver } from '../store/authStore';
import { COLORS, ORDER_STATUS_LABELS, TAB_BAR_CLEARANCE } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t, tf } from '../utils/i18n';
import { db } from '../services/firebase';
import OrderOfferCard from '../components/OrderOfferCard';
import { startBackgroundTracking, stopBackgroundTracking, getCurrentLocation } from '../services/locationService';
import * as Notifications from 'expo-notifications';

const { height: SH } = Dimensions.get('window');

const NEARBY_RADIUS_KM = 10;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const HOURS = ['6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p'];
const HOURS_START = 6; // HOURS[i] corresponds to real hour-of-day (HOURS_START + i)
const ETHIOPIA_UTC_OFFSET_HOURS = 3; // EAT is UTC+3 year-round — matches the backend's bucketing
const MIN_ORDERS_FOR_PATTERN = 10; // below this, fall back to the general typical-hours guide

// General guide only (not this driver's data) — approximate Addis Ababa delivery demand shape:
// a morning-commute bump, a lunch rush, and the largest dinner-time peak. Shown until a driver
// has enough of their own completed orders (MIN_ORDERS_FOR_PATTERN) for a real personal chart.
const TYPICAL_HOURLY_PATTERN = [0.2, 0.55, 0.75, 0.5, 0.3, 0.35, 0.7, 0.85, 0.5, 0.3, 0.35, 0.6, 0.85, 1.0, 0.75, 0.4];
const DAILY_GOAL = 500;

// Simulated surge zones around Addis Ababa
const SURGE_ZONES = [
  {
    id: 'bole', label: 'Bole', multiplier: 1.8, color: '#EF444420', stroke: '#EF4444',
    coords: [
      { latitude: 9.0120, longitude: 38.7900 },
      { latitude: 9.0200, longitude: 38.8050 },
      { latitude: 9.0050, longitude: 38.8100 },
      { latitude: 8.9980, longitude: 38.7950 },
    ],
  },
  {
    id: 'piazza', label: 'Piazza', multiplier: 1.5, color: '#F59E0B18', stroke: '#F59E0B',
    coords: [
      { latitude: 9.0380, longitude: 38.7480 },
      { latitude: 9.0450, longitude: 38.7620 },
      { latitude: 9.0310, longitude: 38.7680 },
      { latitude: 9.0250, longitude: 38.7540 },
    ],
  },
  {
    id: 'megenagna', label: 'Megenagna', multiplier: 1.3, color: '#F59E0B12', stroke: '#F59E0B',
    coords: [
      { latitude: 9.0250, longitude: 38.7850 },
      { latitude: 9.0320, longitude: 38.7980 },
      { latitude: 9.0180, longitude: 38.8020 },
      { latitude: 9.0120, longitude: 38.7890 },
    ],
  },
];

export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, driver } = useSelector((s) => s.auth);
  const theme = useSelector((s) => s.settings.theme);
  const language = useSelector((s) => s.settings.language);
  const C = getColors(theme);
  const insets = useSafeAreaInsets();

  const [location, setLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(driver?.status === 'ONLINE');
  const [nearbyOrders, setNearbyOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [todayEarnings, setTodayEarnings] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [goOfflineSheet, setGoOfflineSheet] = useState(false);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);
  const [surgeZones, setSurgeZones] = useState([]);
  const [activityHeatmap, setActivityHeatmap] = useState(null);
  const [heatmapLoaded, setHeatmapLoaded] = useState(false);

  const [scrollY, setScrollY] = useState(0);

  const mapRef = useRef(null);
  const scrollRef = useRef(null);
  const unsubscribeOrdersRef = useRef(null);
  const storeNameCacheRef = useRef(new Map());
  const driverCommissionPercentRef = useRef(85);
  const declinedIdsRef = useRef(new Set());
  const isOnlineRef = useRef(driver?.status === 'ONLINE');
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(300)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  // Addis Ababa local hour, independent of the device's own timezone — otherwise "now" on a
  // Mac/simulator set to a different timezone lands on the wrong bar (or gets clamped to an
  // edge bar), while the real order data (bucketed server-side by Addis time) sits elsewhere.
  const currentHour = (new Date().getUTCHours() + ETHIOPIA_UTC_OFFSET_HOURS) % 24;
  const currentHourIdx = (currentHour >= HOURS_START && currentHour < HOURS_START + HOURS.length)
    ? currentHour - HOURS_START
    : -1;

  const hasActivityPattern = !!activityHeatmap && activityHeatmap.totalOrders >= MIN_ORDERS_FOR_PATTERN;

  useEffect(() => {
    setupLocation();
    // loadData() is handled by the useFocusEffect below instead, which also covers this
    // initial mount — keeping it only in one place avoids double-fetching on first load.
    return () => { stopBackgroundTracking(); unsubscribeOrdersRef.current?.(); };
  }, []);

  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  const showFloatPill = isOnline && nearbyOrders.length > 0 && scrollY > 220;
  useEffect(() => {
    Animated.spring(floatAnim, {
      toValue: showFloatPill ? 1 : 0,
      useNativeDriver: true,
      bounciness: 6,
    }).start();
  }, [showFloatPill]);

  // Staggered "typing indicator" style dot wave for the "Looking for offers" waiting state, so
  // it reads as actively searching instead of a static, possibly-frozen-looking card.
  const showWaiting = isOnline && !activeOrder && nearbyOrders.length === 0 && !showOnlineBanner;
  useEffect(() => {
    if (!showWaiting) return;

    const makeDotLoop = (val, delay) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0.3, duration: 350, useNativeDriver: true }),
        Animated.delay(700),
      ])
    );

    const dotLoop1 = makeDotLoop(dot1Anim, 0);
    const dotLoop2 = makeDotLoop(dot2Anim, 200);
    const dotLoop3 = makeDotLoop(dot3Anim, 400);

    dotLoop1.start();
    dotLoop2.start();
    dotLoop3.start();

    return () => {
      dotLoop1.stop();
      dotLoop2.stop();
      dotLoop3.stop();
      dot1Anim.setValue(0.3);
      dot2Anim.setValue(0.3);
      dot3Anim.setValue(0.3);
    };
  }, [showWaiting]);

  const setupLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) setLocation({ latitude: loc.lat, longitude: loc.lng });
  };

  const handleLocationTipPress = async () => {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (fg.status !== 'granted' && !fg.canAskAgain) {
        Alert.alert(
          t('locPermTitle', language),
          t('locPermBody', language),
          [{ text: t('cancel', language), style: 'cancel' }, { text: t('openSettings', language), onPress: () => Linking.openSettings() }]
        );
        return;
      }

      const bg = await Location.getBackgroundPermissionsAsync();
      if (bg.status === 'granted') {
        Alert.alert(t('locAlreadyOnTitle', language), t('locAlreadyOnBody', language));
        return;
      }
      if (!bg.canAskAgain) {
        Alert.alert(
          t('locAlwaysTitle', language),
          t('locAlwaysBody', language),
          [{ text: t('cancel', language), style: 'cancel' }, { text: t('openSettings', language), onPress: () => Linking.openSettings() }]
        );
        return;
      }

      const granted = await startBackgroundTracking();
      Alert.alert(
        granted ? t('locEnabledTitle', language) : t('locForegroundOnlyTitle', language),
        granted ? t('locEnabledBody', language) : t('locForegroundOnlyBody', language)
      );
    } catch {
      Alert.alert(t('errorTitle', language), t('locErrorBody', language));
    }
  };

  const loadData = async () => {
    if (user?.role !== 'DRIVER') return;
    try {
      const [earningsRes, ordersRes, heatmapRes] = await Promise.all([
        driverAPI.getEarnings('today'),
        orderAPI.getMyOrders({ status: 'DRIVER_ASSIGNED,DRIVER_AT_STORE,PICKED_UP,IN_TRANSIT' }),
        driverAPI.getActivityHeatmap().catch(() => null),
      ]);
      setTodayEarnings(earningsRes.data.data);
      const active = ordersRes.data.data.orders?.find((o) =>
        ['DRIVER_ASSIGNED','DRIVER_AT_STORE','PICKED_UP','IN_TRANSIT'].includes(o.status)
      );
      setActiveOrder(active || null);
      if (heatmapRes) setActivityHeatmap(heatmapRes.data.data);
    } catch {
    } finally {
      setHeatmapLoaded(true);
    }
  };

  // loadData() in the mount effect above only runs once — without this, completing a
  // delivery and navigating back to Home leaves activeOrder stuck referencing the order
  // that was just marked DELIVERED, since nothing ever re-fetches it. Refresh whenever
  // this screen regains focus (e.g. returning from ActiveDeliveryScreen) so a driver is
  // correctly shown as free to receive a new order.
  useFocusEffect(
    useCallback(() => {
      if (user?.role === 'DRIVER') loadData();
    }, [user?.role])
  );

  const resolveStoreName = async (storeId) => {
    if (!storeId) return 'Store';
    if (storeNameCacheRef.current.has(storeId)) return storeNameCacheRef.current.get(storeId);
    try {
      const snap = await getDocs(query(collection(db, 'stores'), where('userId', '==', storeId)));
      const name = snap.empty ? 'Store' : snap.docs[0].data().storeName;
      storeNameCacheRef.current.set(storeId, name);
      return name;
    } catch {
      return 'Store';
    }
  };

  const loadCommissionPercent = async () => {
    try {
      const snap = await getDoc(doc(db, 'commissionSettings', 'default'));
      if (snap.exists()) driverCommissionPercentRef.current = snap.data().driverCommissionPercent ?? 85;
    } catch {}
  };

  // Live delivery offers via a Firestore realtime listener (replaces the old socket.io approach,
  // which required a persistent server that doesn't exist in this Cloud Functions setup).
  useEffect(() => {
    isOnlineRef.current = isOnline;

    if (!isOnline || !location || user?.role !== 'DRIVER') {
      unsubscribeOrdersRef.current?.();
      unsubscribeOrdersRef.current = null;
      setNearbyOrders([]);
      return;
    }

    let isInitialLoad = true;
    loadCommissionPercent();

    const handleChange = async (change) => {
      const isInitial = isInitialLoad; // capture synchronously before any await below
      const order = { id: change.doc.id, ...change.doc.data() };

      if (change.type === 'removed' || order.status !== 'SEARCHING_DRIVER') {
        setNearbyOrders((prev) => prev.filter((o) => o.id !== order.id));
        return;
      }
      if (declinedIdsRef.current.has(order.id)) return;
      if (order.rejectedByDriverIds?.includes(user?.uid)) return;
      if (typeof order.pickupLat !== 'number' || typeof order.pickupLng !== 'number') return;

      const distanceKm = haversineKm(location.latitude, location.longitude, order.pickupLat, order.pickupLng);
      if (distanceKm > NEARBY_RADIUS_KM) {
        setNearbyOrders((prev) => prev.filter((o) => o.id !== order.id));
        return;
      }

      const storeName = await resolveStoreName(order.storeId);
      const driverFee = order.driverFee ?? Math.round((order.totalAmount || 0) * (driverCommissionPercentRef.current / 100));
      const enriched = { ...order, distanceKm, driverFee, store: { storeName } };

      let wasNew = false;
      setNearbyOrders((prev) => {
        wasNew = !prev.find((o) => o.id === order.id);
        return wasNew ? [enriched, ...prev] : prev.map((o) => (o.id === order.id ? enriched : o));
      });

      if (wasNew && !isInitial) {
        Notifications.scheduleNotificationAsync({
          content: {
            title: '⚡ New delivery offer!',
            body: `ETB ${driverFee.toFixed(2)} · ${distanceKm.toFixed(1)} km away`,
            sound: true,
          },
          trigger: null,
        }).catch(() => {});
      }
    };

    const q = query(collection(db, 'orders'), where('status', '==', 'SEARCHING_DRIVER'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(handleChange);
      isInitialLoad = false;
    }, (err) => console.log('[Firestore listener]', err.message));

    unsubscribeOrdersRef.current = unsubscribe;
    return () => unsubscribe();
  }, [isOnline, location]);

  const showBanner = () => {
    setShowOnlineBanner(true);
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(bannerAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setShowOnlineBanner(false));
  };

  const openGoOfflineSheet = () => {
    setGoOfflineSheet(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const closeGoOfflineSheet = () => {
    Animated.timing(sheetAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start(() =>
      setGoOfflineSheet(false)
    );
  };

  const goOnline = async () => {
    if (driver?.status === 'PENDING') {
      Alert.alert(t('pendingApprovalTitle', language), t('pendingApprovalBody', language));
      return;
    }
    if (driver?.status === 'REJECTED') {
      Alert.alert(t('appNotApprovedTitle', language), driver?.rejectionReason || t('contactSupport', language));
      return;
    }
    try {
      setIsLoading(true);
      const { data } = await driverAPI.toggleOnline();
      const nowOnline = data.data.status === 'ONLINE';
      setIsOnline(nowOnline);
      dispatch(updateDriver({ status: data.data.status }));
      if (nowOnline) {
        startBackgroundTracking().catch(() => {});
        showBanner();
        if (location && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.02,
          }, 800);
        }
        setSurgeZones(SURGE_ZONES);
        const surgeRes = await driverAPI.getSurge(driver?.city || 'Addis Ababa').catch(() => null);
        if (surgeRes?.data?.data?.isSurge) {
          Alert.alert(t('surgeActiveAlertTitle', language), tf('surgeMultiplierBody', language, { x: surgeRes.data.data.multiplier }));
        }
      }
    } catch {
      Alert.alert(t('errorTitle', language), t('updateStatusFailed', language));
    } finally {
      setIsLoading(false);
    }
  };

  const confirmGoOffline = async () => {
    closeGoOfflineSheet();
    try {
      setOfflineLoading(true);
      const { data } = await driverAPI.toggleOnline();
      setIsOnline(data.data.status === 'ONLINE');
      dispatch(updateDriver({ status: data.data.status }));
      await stopBackgroundTracking();
    } catch {
      Alert.alert(t('errorTitle', language), t('goOfflineFailed', language));
    } finally {
      setOfflineLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadNearbyOrders();
    setRefreshing(false);
  };

  if (user?.role === 'ADMIN') {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 32 }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 8 }}>{t('adminAccountTitle', language)}</Text>
        <Text style={{ fontSize: 15, color: C.gray, textAlign: 'center' }}>{t('adminAccountBody', language)}</Text>
        <Text style={{ marginTop: 12, fontSize: 13, color: C.gray }}>{user.fullName} · {user.phone}</Text>
      </View>
    );
  }

  const streakCount = driver?.deliveryStreak ?? 0;
  const earned = todayEarnings?.totalEarnings ?? 0;
  const goalPct = Math.min(100, (earned / DAILY_GOAL) * 100);

  const mapHeight = SH * 0.46;

  return (
    <View style={styles.root}>
      {/* ── Map ── */}
      <View style={{ height: mapHeight }}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          showsUserLocation
          showsMyLocationButton={false}
          initialRegion={{
            latitude: location?.latitude || 9.0192,
            longitude: location?.longitude || 38.7525,
            latitudeDelta: 0.0922, longitudeDelta: 0.0421,
          }}
        >
          {surgeZones.map((zone) => (
            <Polygon
              key={zone.id}
              coordinates={zone.coords}
              fillColor={zone.color}
              strokeColor={zone.stroke}
              strokeWidth={1.5}
            />
          ))}
          {nearbyOrders.map((order) => (
            <Marker
              key={order.id}
              coordinate={{ latitude: order.pickupLat, longitude: order.pickupLng }}
              title={order.store?.storeName || `Order ${order.orderNumber}`}
              description={`ETB ${order.driverFee?.toFixed(2)} · ${order.distanceKm?.toFixed(1)} km`}
            >
              <View style={styles.storePin}>
                <Text style={styles.storePinText}>🏪</Text>
                <View style={styles.storePinBubble}>
                  <Text style={styles.storePinPay}>ETB {order.driverFee?.toFixed(0)}</Text>
                </View>
              </View>
            </Marker>
          ))}
        </MapView>

        {isOnline ? (
          <TouchableOpacity
            style={[styles.statusBadge, { top: 16 + insets.top }, styles.onlineBadge, offlineLoading && { opacity: 0.6 }]}
            onPress={openGoOfflineSheet}
            disabled={offlineLoading}
            activeOpacity={0.8}
          >
            <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
            <Text style={styles.statusText}>{t('online', language).toUpperCase()}</Text>
            <Ionicons name="pause" size={12} color="#111827" style={{ marginLeft: 5 }} />
          </TouchableOpacity>
        ) : (
          <View style={[styles.statusBadge, { top: 16 + insets.top }, styles.offlineBadge]}>
            <View style={[styles.statusDot, { backgroundColor: '#9CA3AF' }]} />
            <Text style={styles.statusText}>{t('offline', language).toUpperCase()}</Text>
          </View>
        )}
      </View>

      {/* ── Bottom Sheet ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={60}
      >
        <View style={styles.dragHandle} />

        {/* ── You're Online banner ── */}
        {showOnlineBanner && (
          <Animated.View style={[styles.onlineBanner, {
            opacity: bannerAnim,
            transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          }]}>
            <View style={styles.onlineBannerDot} />
            <Text style={styles.onlineBannerText}>{t('onlineBannerMsg', language)}</Text>
          </Animated.View>
        )}

        {/* Active order banner */}
        {activeOrder && (
          <TouchableOpacity
            style={styles.activeBanner}
            onPress={() => navigation.navigate('ActiveDelivery', { orderId: activeOrder.id })}
          >
            <Text style={styles.activeBannerIcon}>🚚</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.activeBannerTitle}>{t('activeDelivery', language)}</Text>
              <Text style={styles.activeBannerAddr} numberOfLines={1}>{activeOrder.deliveryAddress}</Text>
            </View>
            <Text style={styles.activeBannerChev}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── SPARK NOW button — only shown while offline (or mid-transition). Once online,
             the compact ONLINE badge on the map handles going offline instead, so this large
             CTA doesn't sit around taking up space. ── */}
        {!activeOrder && (!isOnline || offlineLoading) && (
          <TouchableOpacity
            style={[
              styles.sparkBtn,
              isOnline && styles.sparkBtnOnline,
              (isLoading || offlineLoading) && { opacity: 0.7 },
            ]}
            onPress={isOnline ? openGoOfflineSheet : goOnline}
            disabled={isLoading || offlineLoading || driver?.status === 'PENDING' || driver?.status === 'SUSPENDED' || driver?.status === 'REJECTED'}
            activeOpacity={0.88}
          >
            {(isLoading || offlineLoading)
              ? <ActivityIndicator color={isOnline ? COLORS.primary : COLORS.white} />
              : (
                <View style={styles.sparkBtnInner}>
                  <Ionicons
                    name={isOnline ? 'pause' : 'flash'}
                    size={18}
                    color={isOnline ? COLORS.primary : COLORS.white}
                  />
                  <Text style={[styles.sparkBtnText, isOnline && styles.sparkBtnTextOnline]}>{isOnline ? t('goOfflineCaps', language) : t('sparkNow', language)}</Text>
                </View>
              )
            }
          </TouchableOpacity>
        )}

        {/* ── Streak badge ── */}
        {streakCount >= 3 && (
          <View style={styles.driverInfoRow}>
            <View style={styles.streakChip}>
              <Text style={styles.chipIcon}>🔥</Text>
              <Text style={styles.chipVal}>{streakCount}</Text>
              <Text style={styles.chipLabel}>{t('dayStreak', language)}</Text>
            </View>
          </View>
        )}

        {driver?.status === 'PENDING' && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingText}>{t('pendingReviewMsg', language)}</Text>
          </View>
        )}

        {driver?.status === 'REJECTED' && (
          <View style={styles.rejectedCard}>
            <Text style={styles.rejectedText}>
              {t('appNotApprovedMsg', language)}{driver?.rejectionReason ? `: ${driver.rejectionReason}` : '.'} {t('contactSupport', language)}
            </Text>
          </View>
        )}

        {/* ── Today's earnings + goal tracker ── */}
        {todayEarnings && (
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <View style={styles.earningsStat}>
                <Text style={styles.earningsVal}>ETB {todayEarnings.totalEarnings?.toFixed(0) || '0'}</Text>
                <Text style={styles.earningsLabel}>{t('todayEarnings', language)}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsStat}>
                <Text style={styles.earningsVal}>{todayEarnings.totalDeliveries || 0}</Text>
                <Text style={styles.earningsLabel}>{t('trips', language)}</Text>
              </View>
              <View style={styles.earningsDivider} />
              <View style={styles.earningsStat}>
                <Text style={styles.earningsVal}>ETB {todayEarnings.avgPerTrip?.toFixed(0) || '0'}</Text>
                <Text style={styles.earningsLabel}>{t('avgPerTrip', language)}</Text>
              </View>
            </View>
            <View style={styles.goalSection}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>{t('dailyGoal', language)} · ETB {DAILY_GOAL}</Text>
                <Text style={styles.goalPct}>{Math.round(goalPct)}%</Text>
              </View>
              <View style={styles.goalTrack}>
                <View style={[styles.goalFill, { width: `${goalPct}%` }]} />
              </View>
              {goalPct >= 100 && (
                <View style={styles.goalCompleteBadge}>
                  <Text style={styles.goalCompleteText}>{t('dailyGoalReached', language)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Location tip (offline) */}
        {!isOnline && (
          <TouchableOpacity style={styles.tipCard} onPress={handleLocationTipPress} activeOpacity={0.75}>
            <View style={styles.tipIconWrap}>
              <Text style={styles.tipIcon}>⚙️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{t('gettingMoreOffers', language)}</Text>
              <Text style={styles.tipBody}>{t('gettingMoreOffersBody', language)}</Text>
            </View>
            <Text style={styles.tipChev}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Offer cards (online) ── */}
        {isOnline && !activeOrder && nearbyOrders.length > 0 && (
          <View style={styles.offersSection}>
            <View style={styles.offersHeader}>
              <View style={styles.offersPulse} />
              <Text style={styles.offersTitle}>{t('newOffersNearby', language)}</Text>
              <View style={styles.offersBadge}>
                <Text style={styles.offersBadgeText}>{nearbyOrders.length}</Text>
              </View>
            </View>
            {nearbyOrders.map((order) => (
              <OrderOfferCard
                key={order.id}
                order={order}
                onAccept={() => navigation.navigate('ActiveDelivery', { orderId: order.id, autoAccept: true })}
                onDecline={() => {
                  declinedIdsRef.current.add(order.id);
                  setNearbyOrders((prev) => prev.filter((o) => o.id !== order.id));
                  orderAPI.rejectOrder(order.id).catch(() => {});
                }}
                onExpire={() => {
                  declinedIdsRef.current.add(order.id);
                  setNearbyOrders((prev) => prev.filter((o) => o.id !== order.id));
                }}
              />
            ))}
          </View>
        )}

        {/* ── Waiting for offers (online, no offers) ── */}
        {showWaiting && (
          <View style={styles.waitingCard}>
            <View style={styles.waitingTitleRow}>
              <Text style={styles.waitingTitle}>{t('lookingForOffers', language)}</Text>
              <View style={styles.typingDots}>
                <Animated.View style={[styles.typingDot, { opacity: dot1Anim }]} />
                <Animated.View style={[styles.typingDot, { opacity: dot2Anim }]} />
                <Animated.View style={[styles.typingDot, { opacity: dot3Anim }]} />
              </View>
            </View>
            <Text style={styles.waitingBody}>{t('lookingForOffersBody', language)}</Text>
          </View>
        )}

        {/* Activity chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{t('popularOfferTimes', language)}</Text>
            <Text style={styles.chartChev}>›</Text>
          </View>
          {!heatmapLoaded ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <>
              <Text style={styles.chartSub}>
                {hasActivityPattern
                  ? tf('basedOnOrders', language, { n: activityHeatmap.totalOrders })
                  : t('typicalBusyHours', language)}
              </Text>
              <View style={styles.chart}>
                {HOURS.map((h, i) => {
                  const isCurrent = i === currentHourIdx;
                  const level = hasActivityPattern
                    ? (activityHeatmap.normalized[HOURS_START + i] || 0)
                    : TYPICAL_HOURLY_PATTERN[i];
                  const fillH = 28 + level * 42; // tall wall like Spark Driver's reference, with peak/quiet contrast
                  return (
                    <View key={h} style={styles.barWrap}>
                      <View style={styles.barTrack}>
                        {isCurrent && <View style={styles.nowNeedle} />}
                        <View style={[
                          styles.barFill,
                          { height: fillH },
                          isCurrent ? styles.barActive : styles.barInactive,
                          !hasActivityPattern && styles.barEstimated,
                        ]} />
                      </View>
                      <View style={styles.barLabelSlot}>
                        {(i % 4 === 0) && (
                          <Text style={[styles.barLabel, isCurrent && styles.barLabelActive]}>{h}</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
              {!hasActivityPattern && (
                <Text style={styles.chartFootnote}>
                  {tf('completeDeliveriesFootnote', language, { n: MIN_ORDERS_FOR_PATTERN })}
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Go Offline Confirmation Sheet ── */}
      {/* ── Floating offer pill (visible when scrolled past offers) ── */}
      <Animated.View
        pointerEvents={showFloatPill ? 'box-none' : 'none'}
        style={[styles.floatPill, {
          opacity: floatAnim,
          transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }],
        }]}
      >
        <TouchableOpacity
          style={styles.floatPillBtn}
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          activeOpacity={0.85}
        >
          <View style={styles.floatPillDot} />
          <Text style={styles.floatPillText}>
            ⚡ {nearbyOrders.length} {t('newOffer', language)}{language === 'en' && nearbyOrders.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.floatPillArrow}>↑</Text>
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={goOfflineSheet} transparent animationType="none" onRequestClose={closeGoOfflineSheet}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeGoOfflineSheet}>
          <Animated.View
            style={[styles.goOfflineSheet, { transform: [{ translateY: sheetAnim }] }]}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.goOfflineHandle} />

              <Ionicons name="pause-circle" size={40} color={COLORS.text} style={styles.goOfflineEmoji} />
              <Text style={styles.goOfflineTitle}>{t('stopReceivingOffers', language)}</Text>
              <Text style={styles.goOfflineSub}>
                {t('wontReceiveOffers', language)}
              </Text>

              <TouchableOpacity
                style={styles.goOfflineBtn}
                onPress={confirmGoOffline}
                activeOpacity={0.85}
              >
                <Text style={styles.goOfflineBtnText}>{t('goOfflineBtn', language)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.keepEarningBtn}
                onPress={closeGoOfflineSheet}
                activeOpacity={0.85}
              >
                <Text style={styles.keepEarningBtnText}>{t('keepEarning', language)}</Text>
              </TouchableOpacity>

              <View style={{ height: 8 }} />
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },

  statusBadge: {
    position: 'absolute', left: 16,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  onlineBadge: { backgroundColor: '#DCFCE7' },
  offlineBadge: { backgroundColor: '#F3F4F6' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '700', color: '#111827' },

  sheet: { flex: 1, backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -20 },
  sheetContent: { paddingHorizontal: 20, paddingBottom: TAB_BAR_CLEARANCE },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginTop: 10, marginBottom: 16 },

  // You're Online banner
  onlineBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#DCFCE7', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 14, gap: 10,
  },
  onlineBannerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#16A34A' },
  onlineBannerText: { fontSize: 14, fontWeight: '600', color: '#15803D', flex: 1 },

  activeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary, borderRadius: 14,
    padding: 16, marginBottom: 16,
  },
  activeBannerIcon: { fontSize: 22, marginRight: 12 },
  activeBannerTitle: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  activeBannerAddr: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  activeBannerChev: { color: COLORS.accent, fontSize: 24 },

  // SPARK NOW / GO OFFLINE button
  sparkBtn: {
    backgroundColor: COLORS.primary, borderRadius: 50,
    paddingVertical: 19, alignItems: 'center', marginBottom: 20,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  sparkBtnOnline: {
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accentDark,
    shadowOpacity: 0.3,
  },
  sparkBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '900', letterSpacing: 1.5 },
  sparkBtnTextOnline: { color: COLORS.primary },

  pendingCard: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 16 },
  pendingText: { color: '#92400E', fontSize: 13 },
  rejectedCard: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 14, marginBottom: 16 },
  rejectedText: { color: '#991B1B', fontSize: 13 },

  earningsCard: {
    backgroundColor: '#F9FAFB', borderRadius: 14, marginBottom: 16, overflow: 'hidden',
  },
  earningsRow: {
    flexDirection: 'row', padding: 14, alignItems: 'center',
  },
  earningsStat: { flex: 1, alignItems: 'center' },
  earningsVal: { fontSize: 17, fontWeight: '800', color: COLORS.primary },
  earningsLabel: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  earningsDivider: { width: 1, height: 28, backgroundColor: '#E5E7EB' },
  goalSection: {
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  goalLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  goalPct: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  goalTrack: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
  goalCompleteBadge: {
    backgroundColor: COLORS.accent, borderRadius: 8,
    paddingVertical: 7, marginTop: 8, alignItems: 'center',
  },
  goalCompleteText: { fontSize: 12, color: COLORS.primary, fontWeight: '800' },

  driverInfoRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  streakChip: {
    flex: 1, backgroundColor: '#FFFBEB', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.accent,
  },
  chipIcon: { fontSize: 14 },
  chipVal: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  chipLabel: { fontSize: 11, color: COLORS.accentDark },

  storePin: { alignItems: 'center' },
  storePinText: { fontSize: 22 },
  storePinBubble: {
    backgroundColor: '#1F2937', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, marginTop: 2,
  },
  storePinPay: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  floatPill: {
    position: 'absolute',
    bottom: TAB_BAR_CLEARANCE - 20,
    alignSelf: 'center',
    zIndex: 99,
  },
  floatPillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#111827',
    borderRadius: 30, paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 10,
  },
  floatPillDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  floatPillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  floatPillArrow: { color: '#9CA3AF', fontSize: 16, fontWeight: '700' },

  tipCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', borderRadius: 14,
    padding: 16, marginBottom: 16, gap: 14,
  },
  tipIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  tipIcon: { fontSize: 20 },
  tipTitle: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 3 },
  tipBody: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  tipChev: { fontSize: 22, color: '#9CA3AF' },

  // Offers section
  offersSection: { marginBottom: 16 },
  offersHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  offersPulse: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  offersTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  offersBadge: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  offersBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

  // Waiting card
  waitingCard: {
    backgroundColor: '#F9FAFB', borderRadius: 14,
    padding: 20, marginBottom: 16, alignItems: 'center',
  },
  waitingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  waitingTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  typingDots: { flexDirection: 'row', gap: 4 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  waitingBody: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },

  chartSection: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 8 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  chartChev: { fontSize: 20, color: '#9CA3AF' },
  chartSub: { fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 10 },
  chartLoading: { height: 116, alignItems: 'center', justifyContent: 'center' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 10 },
  barWrap: { flex: 1, alignItems: 'center' },
  barTrack: {
    width: '62%', height: 70,
    justifyContent: 'flex-end', overflow: 'visible',
  },
  barFill: { width: '100%', borderRadius: 8 },
  barActive: { backgroundColor: COLORS.primary },
  barInactive: { backgroundColor: '#D8DCE1' },
  barEstimated: { opacity: 0.55 },
  nowNeedle: {
    position: 'absolute', top: -10, left: '50%', marginLeft: -1,
    width: 2, height: 80, borderRadius: 1, backgroundColor: COLORS.primary,
  },
  barLabelSlot: { height: 14, marginTop: 4, alignItems: 'center' },
  barLabel: { fontSize: 9, color: '#9CA3AF' },
  barLabelActive: { color: COLORS.primary, fontWeight: '700' },
  chartFootnote: { fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 8 },

  // Go Offline Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  goOfflineSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32,
  },
  goOfflineHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 24 },
  goOfflineEmoji: { alignSelf: 'center', marginBottom: 12 },
  goOfflineTitle: { fontSize: 22, fontWeight: '800', color: '#111827', textAlign: 'center', marginBottom: 8 },
  goOfflineSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  goOfflineBtn: {
    borderRadius: 50, paddingVertical: 17,
    alignItems: 'center', marginBottom: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  goOfflineBtnText: { fontSize: 16, fontWeight: '700', color: '#374151', letterSpacing: 0.3 },
  keepEarningBtn: {
    borderRadius: 50, paddingVertical: 17,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  keepEarningBtnText: { fontSize: 16, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },
});
