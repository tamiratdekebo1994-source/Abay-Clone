import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { orderAPI } from '../services/api';
import { COLORS, ORDER_STATUS_LABELS, PAYMENT_METHODS } from '../utils/constants';

const TIMELINE_STEPS = [
  { status: 'SEARCHING_DRIVER', label: 'Order placed', icon: '📋' },
  { status: 'DRIVER_ASSIGNED',  label: 'Driver assigned', icon: '🚗' },
  { status: 'DRIVER_AT_STORE',  label: 'Driver at store', icon: '🏪' },
  { status: 'PICKED_UP',        label: 'Package picked up', icon: '📦' },
  { status: 'IN_TRANSIT',       label: 'On the way', icon: '🛣️' },
  { status: 'DELIVERED',        label: 'Delivered', icon: '✅' },
];

const STATUS_ORDER = [
  'SEARCHING_DRIVER', 'DRIVER_ASSIGNED', 'DRIVER_AT_STORE',
  'PICKED_UP', 'IN_TRANSIT', 'DELIVERED',
];

function stepReached(orderStatus, stepStatus) {
  if (orderStatus === 'CANCELLED' || orderStatus === 'FAILED') return false;
  return STATUS_ORDER.indexOf(orderStatus) >= STATUS_ORDER.indexOf(stepStatus);
}

export default function OrderDetailScreen({ route, navigation }) {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    orderAPI.getOrder(orderId)
      .then(({ data }) => setOrder(data.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [orderId]);

  const handleCancel = () => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?\nይህን ትዕዛዝ መሰረዝ ይፈልጋሉ?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await orderAPI.cancelOrder(orderId, 'Cancelled by driver');
              setOrder((prev) => ({ ...prev, status: 'CANCELLED' }));
            } catch (err) {
              Alert.alert('Error', err.response?.data?.message || 'Failed to cancel');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Order not found</Text>
      </View>
    );
  }

  const statusInfo = ORDER_STATUS_LABELS[order.status] || { en: order.status, am: '', color: COLORS.gray };
  const isCancelled = order.status === 'CANCELLED' || order.status === 'FAILED';
  const isDelivered = order.status === 'DELIVERED';
  const isActive = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'].includes(order.status);
  const paymentLabel = PAYMENT_METHODS.find((p) => p.value === order.paymentMethod);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Status Header */}
      <View style={[styles.statusBanner, { backgroundColor: statusInfo.color }]}>
        <Text style={styles.statusEmoji}>
          {isCancelled ? '❌' : isDelivered ? '🎉' : '📦'}
        </Text>
        <Text style={styles.statusLabel}>{statusInfo.en}</Text>
        <Text style={styles.statusLabelAm}>{statusInfo.am}</Text>
        <Text style={styles.orderNum}>Order #{order.orderNumber}</Text>
      </View>

      {/* Earnings card — show to driver */}
      <View style={styles.earningsCard}>
        <View style={styles.earningsRow}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsValue}>ETB {order.driverFee?.toFixed(2)}</Text>
            <Text style={styles.earningsLabel}>Your Earnings</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsItem}>
            <Text style={styles.earningsValue}>{order.distanceKm?.toFixed(1)} km</Text>
            <Text style={styles.earningsLabel}>Distance</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsItem}>
            <Text style={styles.earningsValue}>{paymentLabel?.icon || '💳'}</Text>
            <Text style={styles.earningsLabel}>{paymentLabel?.label || order.paymentMethod}</Text>
          </View>
        </View>
      </View>

      {/* Route */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route</Text>
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Pickup / መነሻ</Text>
              <Text style={styles.routeAddress}>{order.pickupAddress}</Text>
              {order.pickupNotes ? <Text style={styles.routeNote}>{order.pickupNotes}</Text> : null}
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.error }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>Delivery / መድረሻ</Text>
              <Text style={styles.routeAddress}>{order.deliveryAddress}</Text>
              {order.deliveryNotes ? <Text style={styles.routeNote}>{order.deliveryNotes}</Text> : null}
            </View>
          </View>
        </View>
      </View>

      {/* Recipient */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recipient / ተቀባይ</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="👤" label="Name" value={order.recipientName} />
          <InfoRow icon="📞" label="Phone" value={order.recipientPhone} />
        </View>
      </View>

      {/* Package */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Package / ጥቅል</Text>
        <View style={styles.infoCard}>
          <InfoRow icon="📝" label="Description" value={order.description} />
          {order.weight ? <InfoRow icon="⚖️" label="Weight" value={`${order.weight} kg`} /> : null}
          {order.isFragile ? <InfoRow icon="⚠️" label="Special" value="Fragile — handle with care" /> : null}
          {order.requiresRefrigeration ? <InfoRow icon="❄️" label="Special" value="Requires refrigeration" /> : null}
        </View>
      </View>

      {/* Delivery Timeline */}
      {!isCancelled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline / ሂደት</Text>
          <View style={styles.timelineCard}>
            {TIMELINE_STEPS.map((step, i) => {
              const done = stepReached(order.status, step.status);
              const isCurrent = order.status === step.status;
              return (
                <View key={step.status} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[
                      styles.timelineCircle,
                      done && styles.timelineCircleDone,
                      isCurrent && styles.timelineCircleCurrent,
                    ]}>
                      <Text style={styles.timelineCircleText}>
                        {done ? '✓' : isCurrent ? '●' : ' '}
                      </Text>
                    </View>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <View style={[styles.timelineVLine, done && styles.timelineVLineDone]} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineLabel, done && styles.timelineLabelDone]}>
                      {step.icon} {step.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Cancellation reason */}
      {isCancelled && order.cancelReason && (
        <View style={styles.section}>
          <View style={styles.cancelBanner}>
            <Text style={styles.cancelTitle}>Cancellation Reason</Text>
            <Text style={styles.cancelReason}>{order.cancelReason}</Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {isActive && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => navigation.navigate('ActiveDelivery', { orderId: order.id })}
          >
            <Text style={styles.trackBtnText}>📍 Track Delivery</Text>
          </TouchableOpacity>
        )}
        {isActive && (
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => navigation.navigate('Chat', { orderId: order.id, orderNumber: order.orderNumber })}
          >
            <Text style={styles.chatBtnText}>💬 Chat</Text>
          </TouchableOpacity>
        )}
        {isDelivered && !order.review && (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => navigation.navigate('Review', { orderId: order.id, order })}
          >
            <Text style={styles.reviewBtnText}>⭐ Rate this Delivery</Text>
          </TouchableOpacity>
        )}
        {isDelivered && order.review && (
          <View style={styles.reviewedBadge}>
            <Text style={styles.reviewedText}>
              ⭐ You rated {order.review.rating}/5
            </Text>
          </View>
        )}
        {isActive && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={cancelling}
          >
            <Text style={styles.cancelBtnText}>
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoTexts}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: COLORS.gray },

  statusBanner: {
    padding: 24, alignItems: 'center',
  },
  statusEmoji: { fontSize: 40, marginBottom: 8 },
  statusLabel: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  statusLabelAm: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  orderNum: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 8 },

  earningsCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16, marginTop: -1,
    borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  earningsRow: { flexDirection: 'row', paddingVertical: 16 },
  earningsItem: { flex: 1, alignItems: 'center' },
  earningsDivider: { width: 1, backgroundColor: COLORS.grayLight, marginVertical: 8 },
  earningsValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  earningsLabel: { fontSize: 11, color: COLORS.gray, marginTop: 4 },

  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  routeCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeLine: { width: 2, height: 20, backgroundColor: COLORS.grayLight, marginLeft: 4, marginVertical: 4 },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase' },
  routeAddress: { fontSize: 14, color: COLORS.text, fontWeight: '500', marginTop: 2 },
  routeNote: { fontSize: 12, color: COLORS.gray, marginTop: 2 },

  infoCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 12 },
  infoIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  infoTexts: { flex: 1 },
  infoLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase' },
  infoValue: { fontSize: 14, color: COLORS.text, marginTop: 2 },

  timelineCard: {
    backgroundColor: COLORS.white, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 40 },
  timelineLeft: { alignItems: 'center', width: 28, marginRight: 12 },
  timelineCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.grayLight, alignItems: 'center', justifyContent: 'center',
  },
  timelineCircleDone: { backgroundColor: COLORS.primary },
  timelineCircleCurrent: { backgroundColor: COLORS.accent },
  timelineCircleText: { fontSize: 11, color: COLORS.white, fontWeight: '700' },
  timelineVLine: { width: 2, flex: 1, backgroundColor: COLORS.grayLight, minHeight: 18 },
  timelineVLineDone: { backgroundColor: COLORS.primary },
  timelineContent: { flex: 1, paddingBottom: 16 },
  timelineLabel: { fontSize: 14, color: COLORS.gray },
  timelineLabelDone: { color: COLORS.text, fontWeight: '600' },

  cancelBanner: {
    backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FED7D7',
    borderRadius: 12, padding: 14,
  },
  cancelTitle: { fontSize: 13, fontWeight: '700', color: COLORS.error, marginBottom: 4 },
  cancelReason: { fontSize: 13, color: '#C53030' },

  actions: { marginHorizontal: 16, marginTop: 20, gap: 10 },
  trackBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  trackBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  chatBtn: {
    backgroundColor: COLORS.white, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  chatBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  reviewBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  reviewBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  reviewedBadge: {
    backgroundColor: '#F0FDF4', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  reviewedText: { color: COLORS.success, fontSize: 14, fontWeight: '600' },
  cancelBtn: {
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: COLORS.error, fontSize: 14, fontWeight: '600' },
});
