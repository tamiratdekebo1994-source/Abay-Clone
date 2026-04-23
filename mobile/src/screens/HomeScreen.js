import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Switch, Alert, RefreshControl, ActivityIndicator, Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { useSelector, useDispatch } from 'react-redux';
import { driverAPI, orderAPI } from '../services/api';
import { updateDriver } from '../store/authStore';
import { COLORS, ORDER_STATUS_LABELS, SOCKET_URL } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t } from '../utils/i18n';
import OrderOfferCard from '../components/OrderOfferCard';
import EarningsSummary from '../components/EarningsSummary';
import { startBackgroundTracking, stopBackgroundTracking, getCurrentLocation } from '../services/locationService';

export default function HomeScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, driver } = useSelector((state) => state.auth);
  const theme = useSelector((state) => state.settings.theme);
  const C = getColors(theme);
  const [location, setLocation] = useState(null);
  const [isOnline, setIsOnline] = useState(driver?.status === 'ONLINE');
  const [nearbyOrders, setNearbyOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [todayEarnings, setTodayEarnings] = useState(null);
  const [surge, setSurge] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const mapRef = useRef(null);
  const socketRef = useRef(null);
  const isOnlineRef = useRef(driver?.status === 'ONLINE');

  useEffect(() => {
    setupLocation();
    loadData();
    connectSocket();
    return () => {
      stopBackgroundTracking();
      socketRef.current?.disconnect();
    };
  }, []);

  const connectSocket = async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
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

      socket.on('driver_assigned', ({ orderId }) => {
        // Another driver took this order — remove it from the list
        setNearbyOrders((prev) => prev.filter((o) => o.id !== orderId));
      });

      socket.on('no_driver_found', ({ orderId }) => {
        // Order expired with no driver — remove from list
        setNearbyOrders((prev) => prev.filter((o) => o.id !== orderId));
      });

      socketRef.current = socket;
    } catch (err) {
      console.log('[Socket] Connection failed:', err.message);
    }
  };

  const setupLocation = async () => {
    const loc = await getCurrentLocation();
    if (loc) {
      setLocation({ latitude: loc.lat, longitude: loc.lng });
    } else {
      Alert.alert('Location Required', 'Please enable location to receive delivery requests.');
    }
  };

  const loadData = async () => {
    try {
      const [earningsRes, ordersRes] = await Promise.all([
        driverAPI.getEarnings('today'),
        orderAPI.getMyOrders({ status: 'DRIVER_ASSIGNED,DRIVER_AT_STORE,PICKED_UP,IN_TRANSIT' }),
      ]);
      setTodayEarnings(earningsRes.data.data);
      const active = ordersRes.data.data.orders.find((o) =>
        ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'].includes(o.status)
      );
      setActiveOrder(active || null);
    } catch (err) {
      console.error(err);
    }
  };

  const loadNearbyOrders = async () => {
    if (!isOnline || !location) return;
    try {
      const { data } = await driverAPI.getNearbyOrders(
        location.latitude, location.longitude, 10
      );
      setNearbyOrders(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    isOnlineRef.current = isOnline;
    if (isOnline) loadNearbyOrders();
    else setNearbyOrders([]);
  }, [isOnline, location]);

  const toggleOnline = async () => {
    if (driver?.status === 'PENDING') {
      Alert.alert('Pending Approval / ጸድቆ በመጠባበቅ ላይ', 'Your driver application is still being reviewed.\nማመልከቻዎ ገና ይገምገማል።');
      return;
    }
    try {
      setIsLoading(true);
      const { data } = await driverAPI.toggleOnline();
      const nowOnline = data.data.status === 'ONLINE';
      setIsOnline(nowOnline);
      dispatch(updateDriver({ status: data.data.status }));

      if (nowOnline) {
        // Start background location tracking
        await startBackgroundTracking();
        // Fetch surge info
        const surgeRes = await driverAPI.getSurge(driver?.city || 'Addis Ababa');
        setSurge(surgeRes.data.data);
      } else {
        await stopBackgroundTracking();
        setSurge(null);
      }
    } catch (err) {
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

  const styles = getStyles(C);

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          showsUserLocation
          showsMyLocationButton
          initialRegion={{
            latitude: location?.latitude || 9.0192,
            longitude: location?.longitude || 38.7525,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {nearbyOrders.map((order) => (
            <Marker
              key={order.id}
              coordinate={{ latitude: order.pickupLat, longitude: order.pickupLng }}
              title={`Order ${order.orderNumber}`}
              description={`${order.distanceKm}km • ETB ${order.driverFee}`}
              pinColor={COLORS.accent}
            />
          ))}
        </MapView>

        {/* Status Badge */}
        <View style={[styles.statusBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
          <View style={[styles.statusDot, { backgroundColor: isOnline ? COLORS.online : COLORS.offline }]} />
          <Text style={styles.statusText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
        </View>
      </View>

      {/* Bottom Sheet */}
      <ScrollView
        style={styles.bottomSheet}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {/* Toggle Online */}
        <View style={styles.onlineToggle}>
          <View style={styles.onlineToggleLeft}>
            <Text style={styles.onlineTitle}>
              {isOnline ? '🟢 You are Online' : '⚫ You are Offline'}
            </Text>
            <Text style={styles.onlineSubtitle}>
              {isOnline ? 'ትዕዛዞችን እየተቀበሉ ነዎት' : 'ትዕዛዞችን ለመቀበል ያብሩ'}
            </Text>
          </View>
          {isLoading ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Switch
              value={isOnline}
              onValueChange={toggleOnline}
              trackColor={{ false: COLORS.grayLight, true: COLORS.primaryLight }}
              thumbColor={isOnline ? COLORS.primary : COLORS.gray}
              disabled={driver?.status === 'PENDING' || driver?.status === 'SUSPENDED'}
            />
          )}
        </View>

        {/* Driver Pending Warning */}
        {driver?.status === 'PENDING' && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⏳ Your application is under review. You'll be notified once approved.
            </Text>
            <Text style={styles.warningTextAm}>ማመልከቻዎ በግምገማ ላይ ነው። ሲፈቀድ ይነገርዎታል።</Text>
          </View>
        )}

        {/* Surge Banner */}
        {surge?.isSurge && (
          <View style={styles.surgeBanner}>
            <Text style={styles.surgeEmoji}>🔥</Text>
            <View style={styles.surgeInfo}>
              <Text style={styles.surgeTitle}>{t('surgeActive')} — {surge.multiplier}x</Text>
              <Text style={styles.surgeReason}>{surge.reason}</Text>
            </View>
          </View>
        )}

        {/* Today's Earnings */}
        {todayEarnings && <EarningsSummary earnings={todayEarnings} />}

        {/* Active Order */}
        {activeOrder && (
          <TouchableOpacity
            style={styles.activeOrderCard}
            onPress={() => navigation.navigate('ActiveDelivery', { orderId: activeOrder.id })}
          >
            <View style={styles.activeOrderHeader}>
              <Text style={styles.activeOrderTitle}>🚚 Active Delivery</Text>
              <View style={[styles.statusChip, { backgroundColor: ORDER_STATUS_LABELS[activeOrder.status]?.color }]}>
                <Text style={styles.statusChipText}>{ORDER_STATUS_LABELS[activeOrder.status]?.en}</Text>
              </View>
            </View>
            <Text style={styles.activeOrderAddress} numberOfLines={1}>
              📦 {activeOrder.deliveryAddress}
            </Text>
            <Text style={styles.tapText}>Tap to continue →</Text>
          </TouchableOpacity>
        )}

        {/* Nearby Orders */}
        {isOnline && !activeOrder && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              📍 Nearby Delivery Requests ({nearbyOrders.length})
            </Text>
            {nearbyOrders.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No deliveries nearby</Text>
                <Text style={styles.emptyStateTextAm}>ምንም ትዕዛዝ አይደርስም</Text>
              </View>
            ) : (
              nearbyOrders.map((order) => (
                <OrderOfferCard
                  key={order.id}
                  order={order}
                  onAccept={() => navigation.navigate('ActiveDelivery', { orderId: order.id, autoAccept: true })}
                  onExpire={() => setNearbyOrders((prev) => prev.filter((o) => o.id !== order.id))}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  mapContainer: { height: '45%', position: 'relative' },
  map: { flex: 1 },
  statusBadge: {
    position: 'absolute', top: 16, left: 16,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  onlineBadge: { backgroundColor: '#E8F5E9' },
  offlineBadge: { backgroundColor: '#F5F5F5' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 12, fontWeight: '700' },
  bottomSheet: { flex: 1, backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  onlineToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: C.grayLight,
  },
  onlineToggleLeft: { flex: 1 },
  onlineTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  onlineSubtitle: { fontSize: 13, color: C.gray, marginTop: 2 },
  warningBox: { margin: 16, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 14 },
  warningText: { color: '#92400E', fontSize: 14, fontWeight: '500' },
  warningTextAm: { color: '#92400E', fontSize: 12, marginTop: 4 },
  surgeBanner: {
    margin: 16, marginTop: 0, backgroundColor: '#FEF3C7',
    borderRadius: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
    borderLeftWidth: 4, borderLeftColor: COLORS.accent,
  },
  surgeEmoji: { fontSize: 24 },
  surgeInfo: { flex: 1 },
  surgeTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  surgeReason: { fontSize: 12, color: '#B45309', marginTop: 2 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  emptyState: { alignItems: 'center', padding: 32 },
  emptyStateText: { fontSize: 16, color: C.gray },
  emptyStateTextAm: { fontSize: 14, color: C.gray, marginTop: 4 },
  activeOrderCard: {
    margin: 16, backgroundColor: COLORS.primary,
    borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  activeOrderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  activeOrderTitle: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusChipText: { color: COLORS.white, fontSize: 11, fontWeight: '600' },
  activeOrderAddress: { color: COLORS.grayLighter, fontSize: 14 },
  tapText: { color: COLORS.accent, fontSize: 13, marginTop: 8, fontWeight: '600' },
});
