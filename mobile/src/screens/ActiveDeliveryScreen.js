import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Linking, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { orderAPI, uploadAPI } from '../services/api';
import { COLORS, ORDER_STATUS_LABELS, GOOGLE_MAPS_API_KEY } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t, tf } from '../utils/i18n';
import SlideToConfirm from '../components/SlideToConfirm';

function decodePolyline(encoded) {
  const points = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, b;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

const STATUS_FLOW = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

// Action-oriented slide labels for each step, rather than a generic "Slide to <status>".
const SLIDE_ACTION_KEYS = {
  DRIVER_AT_STORE: 'confirmArrival',
  PICKED_UP: 'completePickup',
  IN_TRANSIT: 'navigateToDestination',
  DELIVERED: 'completeDelivery',
};

export default function ActiveDeliveryScreen({ route, navigation }) {
  const { orderId, autoAccept } = route.params || {};
  const theme = useSelector((s) => s.settings.theme);
  const language = useSelector((s) => s.settings.language);
  const C = getColors(theme);
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [nextStepText, setNextStepText] = useState('');
  const [eta, setEta] = useState(null);
  const [podPhotoUri, setPodPhotoUri] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    if (autoAccept && orderId) handleAcceptOrder();
    else loadOrder();
  }, [orderId]);

  const handleAcceptOrder = async () => {
    try {
      const { data } = await orderAPI.acceptOrder(orderId);
      setOrder(data.data);
      fetchRoute(data.data);
    } catch (err) {
      Alert.alert(t('errorTitle', language), err.response?.data?.message || t('failedToAcceptOrder', language));
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrder = async () => {
    try {
      const { data } = await orderAPI.getOrder(orderId);
      setOrder(data.data);
      fetchRoute(data.data);
    } catch {
      Alert.alert(t('errorTitle', language), t('failedToLoadOrder', language));
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoute = async (orderData) => {
    if (!GOOGLE_MAPS_API_KEY) return;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const origin = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const isPickup = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE'].includes(orderData.status);
      const dest = isPickup
        ? { lat: orderData.pickupLat, lng: orderData.pickupLng }
        : { lat: orderData.deliveryLat, lng: orderData.deliveryLng };
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.lat},${dest.lng}&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.routes?.length) {
        const coords = decodePolyline(json.routes[0].overview_polyline.points);
        setRouteCoords(coords);
        const leg = json.routes[0].legs[0];
        const rawStep = leg?.steps[0]?.html_instructions || '';
        setNextStepText(rawStep.replace(/<[^>]+>/g, ''));
        if (leg?.duration?.text) setEta(leg.duration.text);
        // Auto-fit map to show full route
        if (mapRef.current && coords.length > 1) {
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(
              [origin, { latitude: dest.lat, longitude: dest.lng }],
              { edgePadding: { top: 80, right: 40, bottom: 80, left: 40 }, animated: true }
            );
          }, 500);
        }
      }
    } catch (_) {}
  };

  const uploadPodPhoto = async (uri) => {
    setIsUploadingPhoto(true);
    try {
      await uploadAPI.cargoPhoto(orderId, uri);
      setPodPhotoUri(uri);
    } catch {
      Alert.alert(t('uploadFailedTitle', language), t('uploadFailedBody', language));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permissionNeededTitle', language), t('cameraPermBody', language));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: false });
    if (result.canceled) return;
    await uploadPodPhoto(result.assets[0].uri);
  };

  const handleChooseFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permissionNeededTitle', language), t('libraryPermBody', language));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: false });
    if (result.canceled) return;
    await uploadPodPhoto(result.assets[0].uri);
  };

  const updateStatus = async (newStatus) => {
    // The slide gesture itself is the confirmation — no separate "are you sure?" dialog needed.
    try {
      setIsUpdating(true);
      const { data } = await orderAPI.updateStatus(orderId, newStatus);
      const updatedOrder = { ...order, status: data.data.status };
      setOrder(updatedOrder);
      setRouteCoords([]);
      setNextStepText('');
      if (newStatus !== 'DELIVERED') fetchRoute(updatedOrder);
      if (newStatus === 'DELIVERED') {
        Alert.alert(
          t('deliveryCompleteTitle', language),
          tf('deliveryCompleteBody', language, { amount: order.driverFee }),
          [{ text: t('ok', language), onPress: () => navigation.navigate('Home') }]
        );
      }
    } catch (err) {
      Alert.alert(t('errorTitle', language), err.response?.data?.message || t('updateStatusFailed', language));
    } finally {
      setIsUpdating(false);
    }
  };

  const getNextStatus = () => {
    const idx = STATUS_FLOW.indexOf(order?.status);
    return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  const styles = getStyles(C);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>{t('loadingOrder', language)}</Text>
      </View>
    );
  }

  if (!order) return null;

  const nextStatus = getNextStatus();
  const nextStatusLabel = nextStatus ? ORDER_STATUS_LABELS[nextStatus] : null;
  const isPickup = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE'].includes(order.status);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        initialRegion={{
          latitude: isPickup ? order.pickupLat : order.deliveryLat,
          longitude: isPickup ? order.pickupLng : order.deliveryLng,
          latitudeDelta: 0.05, longitudeDelta: 0.05,
        }}
      >
        <Marker coordinate={{ latitude: order.pickupLat, longitude: order.pickupLng }} title={t('pickup', language)} pinColor="green" />
        <Marker coordinate={{ latitude: order.deliveryLat, longitude: order.deliveryLng }} title={t('delivery', language)} pinColor="red" />
        {routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeColor={COLORS.primary} strokeWidth={4} />
        )}
      </MapView>

      <View style={[styles.overlayTop, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topBar}>
          <View style={styles.topBarTitleWrap}>
            <Text style={styles.topBarTitle}>{t('activeDelivery', language)}</Text>
            <Text style={styles.topBarSubtitle}>{t('orderNumber', language)} #{order.orderNumber}</Text>
          </View>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.topBarBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={20} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topBarBtn}
              onPress={() => navigation.navigate('Chat', { orderId: order.id, orderNumber: order.orderNumber })}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topBarBtn}
              onPress={() => Linking.openURL(`tel:${order.recipientPhone}`)}
              activeOpacity={0.8}
            >
              <Ionicons name="call-outline" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
        </View>

        {(eta || nextStepText) ? (
          <View style={styles.stepBanner}>
            {eta && (
              <View style={styles.etaBadge}>
                <Text style={styles.etaIcon}>🕐</Text>
                <Text style={styles.etaText}>{tf('etaAwayTemplate', language, { eta })}</Text>
              </View>
            )}
            {nextStepText ? <Text style={styles.stepText} numberOfLines={2}>↗ {nextStepText}</Text> : null}
          </View>
        ) : null}
      </View>

      <ScrollView style={styles.sheet}>
        <View style={[styles.statusHeader, { backgroundColor: ORDER_STATUS_LABELS[order.status]?.color || COLORS.primary }]}>
          <Text style={styles.orderNumber}>{t('orderNumber', language)} #{order.orderNumber}</Text>
          <Text style={styles.statusLabel}>{ORDER_STATUS_LABELS[order.status]?.en}</Text>
          <Text style={styles.statusLabelAm}>{ORDER_STATUS_LABELS[order.status]?.am}</Text>
        </View>

        <View style={styles.earningsRow}>
          <View style={styles.earningItem}>
            <Text style={styles.earningAmount}>ETB {order.driverFee?.toFixed(2)}</Text>
            <Text style={styles.earningLabel}>{t('yourEarnings', language)}</Text>
          </View>
          <View style={styles.earningDivider} />
          <View style={styles.earningItem}>
            <Text style={styles.earningAmount}>{order.distanceKm?.toFixed(1)} km</Text>
            <Text style={styles.earningLabel}>{t('distance', language)}</Text>
          </View>
        </View>

        {isPickup ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('pickupLocationTitle', language)}</Text>
            <Text style={styles.address}>{order.store?.storeName}</Text>
            <Text style={styles.addressSub}>{order.pickupAddress}</Text>
            {order.pickupNotes && <Text style={styles.notes}>{t('note', language)}: {order.pickupNotes}</Text>}
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${order.pickupLat},${order.pickupLng}`)}
            >
              <Text style={styles.navBtnText}>🗺️ {t('navigatePickup', language)}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.pickupDoneRow}>
            <Text style={styles.pickupDoneIcon}>✓</Text>
            <Text style={styles.pickupDoneText}>{tf('pickedUpFromTemplate', language, { name: order.store?.storeName })}</Text>
          </View>
        )}

        <View style={[styles.section, !isPickup && styles.sectionActive]}>
          <Text style={styles.sectionTitle}>{t('deliveryLocationTitle', language)}</Text>
          <Text style={styles.address}>{order.recipientName}</Text>
          <Text style={styles.addressSub}>{order.deliveryAddress}</Text>
          {order.deliveryNotes && <Text style={styles.notes}>{t('note', language)}: {order.deliveryNotes}</Text>}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.navBtn, { flex: 1, marginRight: 8 }]}
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${order.deliveryLat},${order.deliveryLng}`)}
            >
              <Text style={styles.navBtnText}>🗺️ {t('navigate', language)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callBtn, { flex: 1, marginLeft: 8 }]}
              onPress={() => Linking.openURL(`tel:${order.recipientPhone}`)}
            >
              <Text style={styles.navBtnText}>📞 {t('call', language)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('cargoDetailsTitle', language)}</Text>
          <Text style={styles.cargoText}>{order.description}</Text>
          {order.weight && <Text style={styles.cargoDetail}>{t('weight', language)}: {order.weight} kg</Text>}
          {order.isFragile && <Text style={styles.cargoWarning}>{t('fragile', language)}</Text>}
          {order.requiresRefrigeration && <Text style={styles.cargoWarning}>{t('refrigeration', language)}</Text>}
        </View>

        {nextStatus === 'DELIVERED' && (
          <View style={styles.podSection}>
            <Text style={styles.podTitle}>{t('podTitle', language)}</Text>
            <Text style={styles.podSubtitle}>{t('podSubtitle', language)}</Text>
            {podPhotoUri && (
              <Image source={{ uri: podPhotoUri }} style={styles.podPreview} resizeMode="cover" />
            )}
            <TouchableOpacity
              style={[styles.podButton, isUploadingPhoto && styles.podButtonDisabled]}
              onPress={handleTakePhoto}
              disabled={isUploadingPhoto}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.podButtonText}>
                  {podPhotoUri ? t('retakePhoto', language) : t('takePhoto', language)}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.podLibraryLink}
              onPress={handleChooseFromLibrary}
              disabled={isUploadingPhoto}
            >
              <Text style={styles.podLibraryLinkText}>{t('chooseFromLibrary', language)}</Text>
            </TouchableOpacity>
          </View>
        )}

        {nextStatus && (
          <View style={styles.slideWrap}>
            <SlideToConfirm
              key={nextStatus}
              label={SLIDE_ACTION_KEYS[nextStatus] ? t(SLIDE_ACTION_KEYS[nextStatus], language) : `${t('navigate', language)} ${nextStatusLabel?.en?.toLowerCase()}`}
              labelAm={language === 'en' ? nextStatusLabel?.am : undefined}
              loading={isUpdating}
              disabled={nextStatus === 'DELIVERED' && !podPhotoUri}
              color={COLORS.accent}
              onConfirm={() => updateStatus(nextStatus)}
            />
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1 },
  map: { height: '40%' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
  loadingText: { marginTop: 12, color: C.gray, fontSize: 16 },
  sheet: { flex: 1, backgroundColor: C.white },
  statusHeader: { padding: 20, alignItems: 'center' },
  orderNumber: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  statusLabel: { color: COLORS.white, fontSize: 20, fontWeight: '700', marginTop: 4 },
  statusLabelAm: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 },
  earningsRow: { flexDirection: 'row', backgroundColor: C.grayLighter, padding: 16 },
  earningItem: { flex: 1, alignItems: 'center' },
  earningAmount: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  earningLabel: { fontSize: 12, color: C.gray, marginTop: 2 },
  earningDivider: { width: 1, backgroundColor: C.border },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: C.grayLight },
  sectionActive: { backgroundColor: '#F0FDF4' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.gray, marginBottom: 8 },
  pickupDoneRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderBottomColor: C.grayLight, backgroundColor: '#F9FAFB',
  },
  pickupDoneIcon: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.accent,
    color: COLORS.primary, fontSize: 13, fontWeight: '900', textAlign: 'center',
    lineHeight: 22, marginRight: 10, overflow: 'hidden',
  },
  pickupDoneText: { fontSize: 14, color: C.gray, fontWeight: '600' },
  address: { fontSize: 16, fontWeight: '600', color: C.text },
  addressSub: { fontSize: 14, color: C.gray, marginTop: 2 },
  notes: { fontSize: 13, color: COLORS.primaryLight, marginTop: 6, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  navBtn: { backgroundColor: COLORS.accent, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10 },
  callBtn: { backgroundColor: COLORS.accentDark || '#E8A82A', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10 },
  navBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  cargoText: { fontSize: 15, color: C.text },
  cargoDetail: { fontSize: 14, color: C.gray, marginTop: 4 },
  cargoWarning: { fontSize: 14, color: COLORS.error, marginTop: 6, fontWeight: '600' },
  slideWrap: { margin: 16 },

  overlayTop: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingBottom: 10, gap: 10,
  },
  topBarTitleWrap: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  topBarTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  topBarSubtitle: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  topBarActions: { flexDirection: 'row', gap: 8 },
  topBarBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },

  stepBanner: {
    backgroundColor: 'rgba(17,24,39,0.90)', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
    gap: 6,
  },
  etaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.accent, alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  etaIcon: { fontSize: 13 },
  etaText: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
  stepText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  podSection: {
    margin: 16, padding: 16, backgroundColor: C.grayLighter,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  podTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  podSubtitle: { fontSize: 13, color: C.gray, marginBottom: 12, marginTop: 2 },
  podPreview: { width: '100%', height: 160, borderRadius: 8, marginBottom: 12 },
  podButton: { backgroundColor: COLORS.accent, borderRadius: 8, padding: 12, alignItems: 'center' },
  podButtonDisabled: { opacity: 0.6 },
  podButtonText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
  podLibraryLink: { alignItems: 'center', paddingVertical: 10 },
  podLibraryLinkText: { color: COLORS.primaryLight, fontWeight: '600', fontSize: 13 },
});
