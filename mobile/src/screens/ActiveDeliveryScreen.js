import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Linking, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useSelector } from 'react-redux';
import { orderAPI, uploadAPI } from '../services/api';
import { COLORS, ORDER_STATUS_LABELS, GOOGLE_MAPS_API_KEY } from '../utils/constants';
import { getColors } from '../utils/theme';

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

export default function ActiveDeliveryScreen({ route, navigation }) {
  const { orderId, autoAccept } = route.params || {};
  const theme = useSelector((s) => s.settings.theme);
  const C = getColors(theme);
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
      Alert.alert('Error', err.response?.data?.message || 'Failed to accept order');
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
      Alert.alert('Error', 'Failed to load order');
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

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required for proof of delivery.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: false });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setIsUploadingPhoto(true);
    try {
      await uploadAPI.cargoPhoto(orderId, uri);
      setPodPhotoUri(uri);
    } catch {
      Alert.alert('Upload failed', 'Could not upload the photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const updateStatus = async (newStatus) => {
    Alert.alert(
      'Update Status',
      `Mark order as "${ORDER_STATUS_LABELS[newStatus]?.en}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
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
                  '🎉 Delivery Complete!',
                  `You earned ETB ${order.driverFee}. Great job!`,
                  [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
                );
              }
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to update status');
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
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
        <Text style={styles.loadingText}>Loading order...</Text>
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
        <Marker coordinate={{ latitude: order.pickupLat, longitude: order.pickupLng }} title="Pickup" pinColor="green" />
        <Marker coordinate={{ latitude: order.deliveryLat, longitude: order.deliveryLng }} title="Delivery" pinColor="red" />
        {routeCoords.length > 1 && (
          <Polyline coordinates={routeCoords} strokeColor={COLORS.primary} strokeWidth={4} />
        )}
      </MapView>

      {(eta || nextStepText) ? (
        <View style={styles.stepBanner}>
          {eta && (
            <View style={styles.etaBadge}>
              <Text style={styles.etaIcon}>🕐</Text>
              <Text style={styles.etaText}>{eta} away</Text>
            </View>
          )}
          {nextStepText ? <Text style={styles.stepText} numberOfLines={2}>↗ {nextStepText}</Text> : null}
        </View>
      ) : null}

      <ScrollView style={styles.sheet}>
        <View style={[styles.statusHeader, { backgroundColor: ORDER_STATUS_LABELS[order.status]?.color || COLORS.primary }]}>
          <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
          <Text style={styles.statusLabel}>{ORDER_STATUS_LABELS[order.status]?.en}</Text>
          <Text style={styles.statusLabelAm}>{ORDER_STATUS_LABELS[order.status]?.am}</Text>
        </View>

        <View style={styles.earningsRow}>
          <View style={styles.earningItem}>
            <Text style={styles.earningAmount}>ETB {order.driverFee?.toFixed(2)}</Text>
            <Text style={styles.earningLabel}>Your Earnings</Text>
          </View>
          <View style={styles.earningDivider} />
          <View style={styles.earningItem}>
            <Text style={styles.earningAmount}>{order.distanceKm?.toFixed(1)} km</Text>
            <Text style={styles.earningLabel}>Distance</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Pickup Location</Text>
          <Text style={styles.address}>{order.store?.storeName}</Text>
          <Text style={styles.addressSub}>{order.pickupAddress}</Text>
          {order.pickupNotes && <Text style={styles.notes}>Note: {order.pickupNotes}</Text>}
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${order.pickupLat},${order.pickupLng}`)}
          >
            <Text style={styles.navBtnText}>🗺️ Navigate to Pickup</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏠 Delivery Location</Text>
          <Text style={styles.address}>{order.recipientName}</Text>
          <Text style={styles.addressSub}>{order.deliveryAddress}</Text>
          {order.deliveryNotes && <Text style={styles.notes}>Note: {order.deliveryNotes}</Text>}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.navBtn, { flex: 1, marginRight: 8 }]}
              onPress={() => Linking.openURL(`https://maps.google.com/?q=${order.deliveryLat},${order.deliveryLng}`)}
            >
              <Text style={styles.navBtnText}>🗺️ Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callBtn, { flex: 1, marginLeft: 8 }]}
              onPress={() => Linking.openURL(`tel:${order.recipientPhone}`)}
            >
              <Text style={styles.navBtnText}>📞 Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Cargo Details</Text>
          <Text style={styles.cargoText}>{order.description}</Text>
          {order.weight && <Text style={styles.cargoDetail}>Weight: {order.weight} kg</Text>}
          {order.isFragile && <Text style={styles.cargoWarning}>⚠️ Fragile — Handle with Care!</Text>}
          {order.requiresRefrigeration && <Text style={styles.cargoWarning}>❄️ Requires Refrigeration!</Text>}
        </View>

        {nextStatus === 'DELIVERED' && (
          <View style={styles.podSection}>
            <Text style={styles.podTitle}>📸 Photo Proof of Delivery</Text>
            <Text style={styles.podSubtitle}>Required before completing the delivery</Text>
            {podPhotoUri && (
              <Image source={{ uri: podPhotoUri }} style={styles.podPreview} resizeMode="cover" />
            )}
            <TouchableOpacity
              style={[styles.podButton, isUploadingPhoto && styles.podButtonDisabled]}
              onPress={handleTakePhoto}
              disabled={isUploadingPhoto}
            >
              {isUploadingPhoto ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.podButtonText}>
                  {podPhotoUri ? '📷 Retake Photo' : '📷 Take Photo'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {nextStatus && (
          <TouchableOpacity
            style={[styles.actionButton, (isUpdating || (nextStatus === 'DELIVERED' && !podPhotoUri)) && styles.actionButtonDisabled]}
            onPress={() => updateStatus(nextStatus)}
            disabled={isUpdating || (nextStatus === 'DELIVERED' && !podPhotoUri)}
          >
            {isUpdating ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.actionButtonText}>{nextStatusLabel?.en}</Text>
                <Text style={styles.actionButtonTextAm}>{nextStatusLabel?.am}</Text>
              </>
            )}
          </TouchableOpacity>
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
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.gray, marginBottom: 8 },
  address: { fontSize: 16, fontWeight: '600', color: C.text },
  addressSub: { fontSize: 14, color: C.gray, marginTop: 2 },
  notes: { fontSize: 13, color: COLORS.primaryLight, marginTop: 6, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  navBtn: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10 },
  callBtn: { backgroundColor: COLORS.accentDark || '#E8A82A', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10 },
  navBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  cargoText: { fontSize: 15, color: C.text },
  cargoDetail: { fontSize: 14, color: C.gray, marginTop: 4 },
  cargoWarning: { fontSize: 14, color: COLORS.error, marginTop: 6, fontWeight: '600' },
  actionButton: {
    margin: 16, backgroundColor: COLORS.primary,
    borderRadius: 14, padding: 18, alignItems: 'center',
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  actionButtonDisabled: { opacity: 0.7, shadowOpacity: 0 },
  actionButtonText: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  actionButtonTextAm: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  stepBanner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(17,24,39,0.90)', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
    gap: 6,
  },
  etaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, alignSelf: 'flex-start',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  etaIcon: { fontSize: 13 },
  etaText: { color: COLORS.white, fontSize: 14, fontWeight: '800' },
  stepText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '500' },
  podSection: {
    margin: 16, padding: 16, backgroundColor: C.grayLighter,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  podTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  podSubtitle: { fontSize: 13, color: C.gray, marginBottom: 12, marginTop: 2 },
  podPreview: { width: '100%', height: 160, borderRadius: 8, marginBottom: 12 },
  podButton: { backgroundColor: COLORS.primaryLight, borderRadius: 8, padding: 12, alignItems: 'center' },
  podButtonDisabled: { opacity: 0.6 },
  podButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
});
