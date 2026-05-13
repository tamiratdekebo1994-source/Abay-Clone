import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, RefreshControl, ActivityIndicator,
  Platform, Animated, Dimensions, Modal,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { useSelector, useDispatch } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { driverAPI, orderAPI } from '../services/api';
import { updateDriver } from '../store/authStore';
import { COLORS, ORDER_STATUS_LABELS, SOCKET_URL } from '../utils/constants';
import { getColors } from '../utils/theme';
import OrderOfferCard from '../components/OrderOfferCard';
import { startBackgroundTracking, stopBackgroundTracking, getCurrentLocation } from '../services/locationService';

const { height: SH } = Dimensions.get('window');

const HOURS = ['6a','7a','8a','9a','10a','11a','12p','1p','2p','3p','4p','5p','6p','7p','8p','9p'];
const ACTIVITY = [0.2,0.5,0.8,0.6,0.4,0.5,0.9,0.7,0.8,0.5,0.4,0.6,1.0,0.9,0.8,0.6];

export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, driver } = useSelector((s) => s.auth);
  const theme = useSelector((s) => s.settings.theme);
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

  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const isOnlineRef = useRef(driver?.status === 'ONLINE');
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(300)).current;

  const currentHour = new Date().getHours();
  const currentHourIdx = Math.max(0, Math.min(currentHour - 6, HOURS.length - 1));

  useEffect(() => {
    setupLocation();
    if (user?.role === 'DRIVER') { loadData(); connectSocket(); }
    return () => { stopBackgroundTracking(); socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);

  const connectSocket = async () => {
    if (user?.role !== 'DRIVER') return;
    try {
      const token = await SecureStore.getItemAsync('firebaseIdToken');
      if (!token) return;
      const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'] });
      socket.on('new_order_available', (order) => {
        if (isOnlineRef.current) {
          setNearbyOrders((prev) => {
            if (prev.find((o) => o.orderId === order.orderId || o.id === order.orderId)) return prev;
            return [order, ...prev];
          });
        }
      });
      socket.on('driver_assigned', ({ orderId }) => setNearbyOrders((prev) => prev.filter((o) => o.id !== orderId)));
      socket.on('no_driver_found', ({ orderId }) => setNearbyOrders((prev) => prev.filter((o) => o.id !== orderId)));
      socketRef.current = socket;
    } catch (err) { console.log('[Socket]', err.message); }
  };

  const setupLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) setLocation({ latitude: loc.lat, longitude: loc.lng });
  };

  const loadData = async () => {
    if (user?.role !== 'DRIVER') return;
    try {
      const [earningsRes, ordersRes] = await Promise.all([
        driverAPI.getEarnings('today'),
        orderAPI.getMyOrders({ status: 'DRIVER_ASSIGNED,DRIVER_AT_STORE,PICKED_UP,IN_TRANSIT' }),
      ]);
      setTodayEarnings(earningsRes.data.data);
      const active = ordersRes.data.data.orders?.find((o) =>
        ['DRIVER_ASSIGNED','DRIVER_AT_STORE','PICKED_UP','IN_TRANSIT'].includes(o.status)
      );
      setActiveOrder(active || null);
    } catch {}
  };

  const loadNearbyOrders = async () => {
    if (user?.role !== 'DRIVER' || !isOnline || !location) return;
    try {
      const { data } = await driverAPI.getNearbyOrders(location.latitude, location.longitude, 10);
      setNearbyOrders(data.data);
    } catch {}
  };

  useEffect(() => {
    isOnlineRef.current = isOnline;
    if (isOnline) loadNearbyOrders();
    else setNearbyOrders([]);
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
      Alert.alert('Pending Approval', 'Your driver application is still being reviewed.');
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
        const surgeRes = await driverAPI.getSurge(driver?.city || 'Addis Ababa').catch(() => null);
        if (surgeRes?.data?.data?.isSurge) {
          Alert.alert('🔥 Surge Active', `${surgeRes.data.data.multiplier}x earnings now!`);
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to update status');
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
      Alert.alert('Error', 'Failed to go offline');
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
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 8 }}>Admin Account</Text>
        <Text style={{ fontSize: 15, color: C.gray, textAlign: 'center' }}>Use the web dashboard for admin controls.</Text>
        <Text style={{ marginTop: 12, fontSize: 13, color: C.gray }}>{user.fullName} · {user.phone}</Text>
      </View>
    );
  }

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
          {nearbyOrders.map((order) => (
            <Marker key={order.id}
              coordinate={{ latitude: order.pickupLat, longitude: order.pickupLng }}
              title={`Order ${order.orderNumber}`}
              pinColor={COLORS.accent}
            />
          ))}
        </MapView>

        <View style={[styles.statusBadge, { top: 16 + insets.top },
          isOnline ? styles.onlineBadge : styles.offlineBadge]}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? '#22C55E' : '#9CA3AF' }]} />
          <Text style={styles.statusText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>

      {/* ── Bottom Sheet ── */}
      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.dragHandle} />

        {/* ── You're Online banner ── */}
        {showOnlineBanner && (
          <Animated.View style={[styles.onlineBanner, {
            opacity: bannerAnim,
            transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          }]}>
            <View style={styles.onlineBannerDot} />
            <Text style={styles.onlineBannerText}>You're online! Offers will appear here.</Text>
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
              <Text style={styles.activeBannerTitle}>Active Delivery</Text>
              <Text style={styles.activeBannerAddr} numberOfLines={1}>{activeOrder.deliveryAddress}</Text>
            </View>
            <Text style={styles.activeBannerChev}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── SPARK NOW / GO OFFLINE button ── */}
        {!activeOrder && (
          <TouchableOpacity
            style={[
              styles.sparkBtn,
              isOnline && styles.sparkBtnOnline,
              (isLoading || offlineLoading) && { opacity: 0.7 },
            ]}
            onPress={isOnline ? openGoOfflineSheet : goOnline}
            disabled={isLoading || offlineLoading || driver?.status === 'PENDING' || driver?.status === 'SUSPENDED'}
            activeOpacity={0.88}
          >
            {(isLoading || offlineLoading)
              ? <ActivityIndicator color={COLORS.white} />
              : (
                <View style={styles.sparkBtnInner}>
                  <Text style={styles.sparkBtnIcon}>{isOnline ? '⏸' : '⚡'}</Text>
                  <Text style={styles.sparkBtnText}>{isOnline ? 'GO OFFLINE' : 'SPARK NOW'}</Text>
                </View>
              )
            }
          </TouchableOpacity>
        )}

        {driver?.status === 'PENDING' && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingText}>⏳ Application under review — you'll be notified once approved.</Text>
          </View>
        )}

        {/* Location tip (offline) */}
        {!isOnline && (
          <TouchableOpacity style={styles.tipCard}>
            <View style={styles.tipIconWrap}>
              <Text style={styles.tipIcon}>⚙️</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Getting more offers</Text>
              <Text style={styles.tipBody}>Setting your location access to always sharing helps get more offers.</Text>
            </View>
            <Text style={styles.tipChev}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Offer cards (online) ── */}
        {isOnline && !activeOrder && nearbyOrders.length > 0 && (
          <View style={styles.offersSection}>
            <View style={styles.offersHeader}>
              <View style={styles.offersPulse} />
              <Text style={styles.offersTitle}>New offers nearby</Text>
              <View style={styles.offersBadge}>
                <Text style={styles.offersBadgeText}>{nearbyOrders.length}</Text>
              </View>
            </View>
            {nearbyOrders.map((order) => (
              <OrderOfferCard key={order.id} order={order}
                onAccept={() => navigation.navigate('ActiveDelivery', { orderId: order.id, autoAccept: true })}
                onExpire={() => setNearbyOrders((prev) => prev.filter((o) => o.id !== order.id))}
              />
            ))}
          </View>
        )}

        {/* ── Waiting for offers (online, no offers) ── */}
        {isOnline && !activeOrder && nearbyOrders.length === 0 && !showOnlineBanner && (
          <View style={styles.waitingCard}>
            <Text style={styles.waitingEmoji}>📡</Text>
            <Text style={styles.waitingTitle}>Looking for offers</Text>
            <Text style={styles.waitingBody}>Stay in a busy area to receive more delivery offers.</Text>
          </View>
        )}

        {/* Activity chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Popular offer times: today</Text>
            <Text style={styles.chartChev}>›</Text>
          </View>
          <Text style={styles.chartSub}>Explore additional days to drive this week.</Text>
          <View style={styles.chart}>
            {HOURS.map((h, i) => {
              const isCurrent = i === currentHourIdx;
              const fillH = Math.max(4, ACTIVITY[i] * 72);
              return (
                <View key={h} style={styles.barWrap}>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: fillH },
                      isCurrent ? styles.barActive : styles.barInactive]} />
                  </View>
                  {(i % 4 === 0) && (
                    <Text style={[styles.barLabel, isCurrent && styles.barLabelActive]}>{h}</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* ── Go Offline Confirmation Sheet ── */}
      <Modal visible={goOfflineSheet} transparent animationType="none" onRequestClose={closeGoOfflineSheet}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeGoOfflineSheet}>
          <Animated.View
            style={[styles.goOfflineSheet, { transform: [{ translateY: sheetAnim }] }]}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.goOfflineHandle} />

              <Text style={styles.goOfflineEmoji}>⏸</Text>
              <Text style={styles.goOfflineTitle}>Stop receiving offers?</Text>
              <Text style={styles.goOfflineSub}>
                You won't receive new delivery offers while you're offline.
              </Text>

              <TouchableOpacity
                style={styles.goOfflineBtn}
                onPress={confirmGoOffline}
                activeOpacity={0.85}
              >
                <Text style={styles.goOfflineBtnText}>Go Offline</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.keepEarningBtn}
                onPress={closeGoOfflineSheet}
                activeOpacity={0.85}
              >
                <Text style={styles.keepEarningBtnText}>Keep Earning</Text>
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
  sheetContent: { paddingHorizontal: 20, paddingBottom: 32 },
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
    backgroundColor: '#1F2937',
    shadowColor: '#000',
    shadowOpacity: 0.2,
  },
  sparkBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkBtnIcon: { fontSize: 18 },
  sparkBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '900', letterSpacing: 1.5 },

  pendingCard: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 16 },
  pendingText: { color: '#92400E', fontSize: 13 },

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
  waitingEmoji: { fontSize: 32, marginBottom: 10 },
  waitingTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  waitingBody: { fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 19 },

  chartSection: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, marginBottom: 8 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  chartChev: { fontSize: 20, color: '#9CA3AF' },
  chartSub: { fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 14 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 96, paddingTop: 4 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack: {
    width: 5, height: 72,
    backgroundColor: '#EAECEF', borderRadius: 3,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  barFill: { width: '100%', borderRadius: 3 },
  barActive: { backgroundColor: COLORS.primary },
  barInactive: { backgroundColor: '#C9CDD4' },
  barLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 5 },
  barLabelActive: { color: COLORS.primary, fontWeight: '700' },

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
  goOfflineEmoji: { fontSize: 36, textAlign: 'center', marginBottom: 12 },
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
