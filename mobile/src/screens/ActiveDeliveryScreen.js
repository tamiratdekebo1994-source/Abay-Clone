import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Linking, ScrollView, ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { orderAPI } from '../services/api';
import { COLORS, ORDER_STATUS_LABELS } from '../utils/constants';

const STATUS_FLOW = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

export default function ActiveDeliveryScreen({ route, navigation }) {
  const { orderId, autoAccept } = route.params || {};
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (autoAccept && orderId) {
      handleAcceptOrder();
    } else {
      loadOrder();
    }
  }, [orderId]);

  const handleAcceptOrder = async () => {
    try {
      const { data } = await orderAPI.acceptOrder(orderId);
      setOrder(data.data);
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
    } catch (err) {
      Alert.alert('Error', 'Failed to load order');
      navigation.goBack();
    } finally {
      setIsLoading(false);
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
              setOrder((prev) => ({ ...prev, status: data.data.status }));
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

  const openNavigation = (lat, lng, label) => {
    const url = `https://maps.google.com/?q=${lat},${lng}&label=${encodeURIComponent(label)}`;
    Linking.openURL(url);
  };

  const callRecipient = (phone) => {
    Linking.openURL(`tel:${phone}`);
  };

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
      {/* Map */}
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
        <Marker
          coordinate={{ latitude: order.pickupLat, longitude: order.pickupLng }}
          title="Pickup"
          pinColor="green"
        />
        <Marker
          coordinate={{ latitude: order.deliveryLat, longitude: order.deliveryLng }}
          title="Delivery"
          pinColor="red"
        />
      </MapView>

      {/* Order Info Sheet */}
      <ScrollView style={styles.sheet}>
        {/* Status Header */}
        <View style={[styles.statusHeader, { backgroundColor: ORDER_STATUS_LABELS[order.status]?.color || COLORS.primary }]}>
          <Text style={styles.orderNumber}>Order #{order.orderNumber}</Text>
          <Text style={styles.statusLabel}>{ORDER_STATUS_LABELS[order.status]?.en}</Text>
          <Text style={styles.statusLabelAm}>{ORDER_STATUS_LABELS[order.status]?.am}</Text>
        </View>

        {/* Earnings */}
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

        {/* Pickup Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📦 Pickup Location</Text>
          <Text style={styles.address}>{order.store?.storeName}</Text>
          <Text style={styles.addressSub}>{order.pickupAddress}</Text>
          {order.pickupNotes && (
            <Text style={styles.notes}>Note: {order.pickupNotes}</Text>
          )}
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonPickup]}
            onPress={() => openNavigation(order.pickupLat, order.pickupLng, 'Pickup')}
          >
            <Text style={styles.navButtonText}>🗺️ Navigate to Pickup</Text>
          </TouchableOpacity>
        </View>

        {/* Delivery Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏠 Delivery Location</Text>
          <Text style={styles.address}>{order.recipientName}</Text>
          <Text style={styles.addressSub}>{order.deliveryAddress}</Text>
          {order.deliveryNotes && (
            <Text style={styles.notes}>Note: {order.deliveryNotes}</Text>
          )}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonDelivery, { flex: 1, marginRight: 8 }]}
              onPress={() => openNavigation(order.deliveryLat, order.deliveryLng, 'Delivery')}
            >
              <Text style={styles.navButtonText}>🗺️ Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.callButton, { flex: 1, marginLeft: 8 }]}
              onPress={() => callRecipient(order.recipientPhone)}
            >
              <Text style={styles.navButtonText}>📞 Call</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cargo Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Cargo Details</Text>
          <Text style={styles.cargoText}>{order.description}</Text>
          {order.weight && <Text style={styles.cargoDetail}>Weight: {order.weight} kg</Text>}
          {order.isFragile && <Text style={styles.cargoWarning}>⚠️ Fragile - Handle with Care!</Text>}
          {order.requiresRefrigeration && <Text style={styles.cargoWarning}>❄️ Requires Refrigeration!</Text>}
        </View>

        {/* Action Button */}
        {nextStatus && (
          <TouchableOpacity
            style={[styles.actionButton, isUpdating && styles.actionButtonDisabled]}
            onPress={() => updateStatus(nextStatus)}
            disabled={isUpdating}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { height: '40%' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: COLORS.gray, fontSize: 16 },
  sheet: { flex: 1, backgroundColor: COLORS.white },
  statusHeader: { padding: 20, alignItems: 'center' },
  orderNumber: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  statusLabel: { color: COLORS.white, fontSize: 20, fontWeight: '700', marginTop: 4 },
  statusLabelAm: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 },
  earningsRow: { flexDirection: 'row', backgroundColor: COLORS.grayLighter, padding: 16 },
  earningItem: { flex: 1, alignItems: 'center' },
  earningAmount: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  earningLabel: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  earningDivider: { width: 1, backgroundColor: COLORS.border },
  section: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray, marginBottom: 8 },
  address: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  addressSub: { fontSize: 14, color: COLORS.gray, marginTop: 2 },
  notes: { fontSize: 13, color: COLORS.primaryLight, marginTop: 6, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  navButton: { borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10 },
  navButtonPickup: { backgroundColor: COLORS.primary },
  navButtonDelivery: { backgroundColor: COLORS.primaryLight },
  callButton: { backgroundColor: COLORS.accentDark || '#E8A82A' },
  navButtonText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  cargoText: { fontSize: 15, color: COLORS.text },
  cargoDetail: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  cargoWarning: { fontSize: 14, color: COLORS.error, marginTop: 6, fontWeight: '600' },
  actionButton: {
    margin: 16, backgroundColor: COLORS.primary,
    borderRadius: 14, padding: 18, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  actionButtonDisabled: { opacity: 0.7 },
  actionButtonText: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  actionButtonTextAm: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
});
