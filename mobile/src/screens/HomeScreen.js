import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, RefreshControl, ActivityIndicator,
  Platform, Animated, Dimensions,
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

// Simulated hourly activity data (6am–9pm)
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
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const isOnlineRef = useRef(driver?.status === 'ONLINE');

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

  const toggleOnline = async () => {
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
        await startBackgroundTracking();
        const surgeRes = await driverAPI.getSurge(driver?.city || 'Addis Ababa').catch(() => null);
        if (surgeRes?.data?.data?.isSurge) {
          Alert.alert('🔥 Surge Active', `${surgeRes.data.data.multiplier}x earnings now!`);
        }
      } else {
        await stopBackgroundTracking();
      }
    } catch {
      Alert.alert('Error', 'Failed to update status');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadNearbyOrders();
    setRefreshing(false);
  };

  // Admin view
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
  const earnings = todayEarnings;

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

        {/* Status badge */}
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
        {/* Drag handle */}
        <View style={styles.dragHandle} />

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

        {/* SPARK NOW / GO OFFLINE button */}
        {!activeOrder && (
          <TouchableOpacity
            style={[styles.sparkBtn, isOnline && styles.sparkBtnOnline, isLoading && { opacity: 0.7 }]}
            onPress={toggleOnline}
            disabled={isLoading || driver?.status === 'PENDING' || driver?.status === 'SUSPENDED'}
            activeOpacity={0.85}
          >
            {isLoading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.sparkBtnText}>
                  {isOnline ? 'GO OFFLINE' : 'SPARK NOW'}
                </Text>
            }
          </TouchableOpacity>
        )}

        {/* Pending warning */}
        {driver?.status === 'PENDING' && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingText}>⏳ Application under review — you'll be notified once approved.</Text>
          </View>
        )}

        {/* Today earnings summary */}
        {earnings && (
          <View style={styles.earningsRow}>
            <View style={styles.earningsStat}>
              <Text style={styles.earningsVal}>ETB {earnings.totalEarnings?.toFixed(0) || '0'}</Text>
              <Text style={styles.earningsLabel}>Earned today</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsStat}>
              <Text style={styles.earningsVal}>{earnings.totalDeliveries || 0}</Text>
              <Text style={styles.earningsLabel}>Trips</Text>
            </View>
            <View style={styles.earningsDivider} />
            <View style={styles.earningsStat}>
              <Text style={styles.earningsVal}>ETB {earnings.avgPerTrip?.toFixed(0) || '0'}</Text>
              <Text style={styles.earningsLabel}>Avg/Trip</Text>
            </View>
          </View>
        )}

        {/* Location tip */}
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

        {/* Nearby orders when online */}
        {isOnline && !activeOrder && nearbyOrders.length > 0 && (
          <View style={styles.ordersSection}>
            <Text style={styles.sectionTitle}>📍 Nearby Requests ({nearbyOrders.length})</Text>
            {nearbyOrders.map((order) => (
              <OrderOfferCard key={order.id} order={order}
                onAccept={() => navigation.navigate('ActiveDelivery', { orderId: order.id, autoAccept: true })}
                onExpire={() => setNearbyOrders((prev) => prev.filter((o) => o.id !== order.id))}
              />
            ))}
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
              const barH = Math.max(8, ACTIVITY[i] * 64);
              return (
                <View key={h} style={styles.barWrap}>
                  <View style={[styles.bar, { height: barH },
                    isCurrent ? styles.barActive : styles.barInactive]} />
                  {(i % 3 === 0) && <Text style={[styles.barLabel, isCurrent && styles.barLabelActive]}>{h}</Text>}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
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

  activeBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary, borderRadius: 14,
    padding: 16, marginBottom: 16,
  },
  activeBannerIcon: { fontSize: 22, marginRight: 12 },
  activeBannerTitle: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  activeBannerAddr: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  activeBannerChev: { color: COLORS.accent, fontSize: 24 },

  sparkBtn: {
    backgroundColor: COLORS.primary, borderRadius: 50,
    paddingVertical: 20, alignItems: 'center', marginBottom: 20,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  sparkBtnOnline: { backgroundColor: '#374151' },
  sparkBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '900', letterSpacing: 1.5 },

  pendingCard: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginBottom: 16 },
  pendingText: { color: '#92400E', fontSize: 13 },

  earningsRow: {
    flexDirection: 'row', backgroundColor: '#F9FAFB',
    borderRadius: 14, padding: 16, marginBottom: 16, alignItems: 'center',
  },
  earningsStat: { flex: 1, alignItems: 'center' },
  earningsVal: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  earningsLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  earningsDivider: { width: 1, height: 32, backgroundColor: '#E5E7EB' },

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

  ordersSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },

  chartSection: {
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, marginBottom: 8,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  chartChev: { fontSize: 20, color: '#9CA3AF' },
  chartSub: { fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 14 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '80%', borderRadius: 3 },
  barActive: { backgroundColor: COLORS.primary },
  barInactive: { backgroundColor: '#D1D5DB' },
  barLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 4 },
  barLabelActive: { color: COLORS.primary, fontWeight: '700' },
});
