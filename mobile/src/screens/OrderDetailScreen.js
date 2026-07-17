import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useSelector } from 'react-redux';
import { orderAPI } from '../services/api';
import { COLORS, ORDER_STATUS_LABELS, PAYMENT_METHODS } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t, tf } from '../utils/i18n';

const TIMELINE_STEPS = [
  { status: 'SEARCHING_DRIVER', labelKey: 'tl_orderPlaced',    icon: '📋' },
  { status: 'DRIVER_ASSIGNED',  labelKey: 'tl_driverAssigned', icon: '🚗' },
  { status: 'DRIVER_AT_STORE',  labelKey: 'tl_driverAtStore',  icon: '🏪' },
  { status: 'PICKED_UP',        labelKey: 'tl_pickedUp',       icon: '📦' },
  { status: 'IN_TRANSIT',       labelKey: 'tl_onTheWay',       icon: '🛣️' },
  { status: 'DELIVERED',        labelKey: 'tl_delivered',      icon: '✅' },
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
  const theme = useSelector((s) => s.settings.theme);
  const language = useSelector((s) => s.settings.language);
  const C = getColors(theme);
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
      t('cancelOrderTitle', language),
      t('cancelOrderConfirmBody', language),
      [
        { text: t('no', language), style: 'cancel' },
        {
          text: t('yesCancelBtn', language), style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              await orderAPI.cancelOrder(orderId, 'Cancelled by driver');
              setOrder((prev) => ({ ...prev, status: 'CANCELLED' }));
            } catch (err) {
              Alert.alert(t('errorTitle', language), err.response?.data?.message || t('failedToCancel', language));
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const styles = getStyles(C);

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (!order) {
    return <View style={styles.center}><Text style={styles.errorText}>{t('orderNotFound', language)}</Text></View>;
  }

  const statusInfo = ORDER_STATUS_LABELS[order.status] || { en: order.status, am: '', color: COLORS.gray };
  const isCancelled = order.status === 'CANCELLED' || order.status === 'FAILED';
  const isDelivered = order.status === 'DELIVERED';
  const isActive = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'].includes(order.status);
  const paymentLabel = PAYMENT_METHODS.find((p) => p.value === order.paymentMethod);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: statusInfo.color }]}>
        <Text style={styles.statusEmoji}>{isCancelled ? '❌' : isDelivered ? '🎉' : '📦'}</Text>
        <Text style={styles.statusLabel}>{statusInfo.en}</Text>
        <Text style={styles.statusLabelAm}>{statusInfo.am}</Text>
        <Text style={styles.orderNum}>{t('orderNumber', language)} #{order.orderNumber}</Text>
      </View>

      {/* Earnings */}
      <View style={styles.earningsCard}>
        <View style={styles.earningsRow}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsValue}>ETB {order.driverFee?.toFixed(2)}</Text>
            <Text style={styles.earningsLabel}>{t('yourEarnings', language)}</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsItem}>
            <Text style={styles.earningsValue}>{order.distanceKm?.toFixed(1)} km</Text>
            <Text style={styles.earningsLabel}>{t('distance', language)}</Text>
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
        <Text style={styles.sectionTitle}>{t('route', language)}</Text>
        <View style={styles.card}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>{t('pickup', language)}</Text>
              <Text style={styles.routeAddress}>{order.pickupAddress}</Text>
              {order.pickupNotes ? <Text style={styles.routeNote}>{order.pickupNotes}</Text> : null}
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.error }]} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeLabel}>{t('delivery', language)}</Text>
              <Text style={styles.routeAddress}>{order.deliveryAddress}</Text>
              {order.deliveryNotes ? <Text style={styles.routeNote}>{order.deliveryNotes}</Text> : null}
            </View>
          </View>
        </View>
      </View>

      {/* Recipient */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('recipient', language)}</Text>
        <View style={styles.card}>
          <InfoRow icon="👤" label={t('name', language)} value={order.recipientName} C={C} />
          <InfoRow icon="📞" label={t('phone', language)} value={order.recipientPhone} C={C} />
        </View>
      </View>

      {/* Package */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('package', language)}</Text>
        <View style={styles.card}>
          <InfoRow icon="📝" label={t('description', language)} value={order.description} C={C} />
          {order.weight ? <InfoRow icon="⚖️" label={t('weight', language)} value={`${order.weight} kg`} C={C} /> : null}
          {order.isFragile ? <InfoRow icon="⚠️" label={t('special', language)} value={t('fragileHandleCare', language)} C={C} /> : null}
          {order.requiresRefrigeration ? <InfoRow icon="❄️" label={t('special', language)} value={t('requiresRefrigerationShort', language)} C={C} /> : null}
        </View>
      </View>

      {/* Timeline */}
      {!isCancelled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('timeline', language)}</Text>
          <View style={styles.card}>
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
                      {step.icon} {t(step.labelKey, language)}
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
            <Text style={styles.cancelTitle}>{t('cancellationReason', language)}</Text>
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
            <Text style={styles.trackBtnText}>{t('trackDelivery', language)}</Text>
          </TouchableOpacity>
        )}
        {isActive && (
          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => navigation.navigate('Chat', { orderId: order.id, orderNumber: order.orderNumber })}
          >
            <Text style={styles.chatBtnText}>💬 {t('chat', language)}</Text>
          </TouchableOpacity>
        )}
        {isDelivered && !order.review && (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() => navigation.navigate('Review', { orderId: order.id, order })}
          >
            <Text style={styles.reviewBtnText}>{t('rateThisDelivery', language)}</Text>
          </TouchableOpacity>
        )}
        {isDelivered && order.review && (
          <View style={styles.reviewedBadge}>
            <Text style={styles.reviewedText}>{tf('youRatedTemplate', language, { rating: order.review.rating })}</Text>
          </View>
        )}
        {isActive && (
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={cancelling}>
            <Text style={styles.cancelBtnText}>{cancelling ? t('cancelling', language) : t('cancelOrderBtn', language)}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value, C }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 12 }}>
      <Text style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: C.gray, fontWeight: '600', textTransform: 'uppercase' }}>{label}</Text>
        <Text style={{ fontSize: 14, color: C.text, marginTop: 2 }}>{value}</Text>
      </View>
    </View>
  );
}

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
  errorText: { fontSize: 16, color: C.gray },
  statusBanner: { padding: 24, alignItems: 'center' },
  statusEmoji: { fontSize: 40, marginBottom: 8 },
  statusLabel: { color: COLORS.white, fontSize: 20, fontWeight: '800' },
  statusLabelAm: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  orderNum: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 8 },
  earningsCard: {
    backgroundColor: C.white, marginHorizontal: 16, marginTop: -1,
    borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  earningsRow: { flexDirection: 'row', paddingVertical: 16 },
  earningsItem: { flex: 1, alignItems: 'center' },
  earningsDivider: { width: 1, backgroundColor: C.grayLight, marginVertical: 8 },
  earningsValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  earningsLabel: { fontSize: 11, color: C.gray, marginTop: 4 },
  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: C.gray,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  card: {
    backgroundColor: C.white, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
    overflow: 'hidden',
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeLine: { width: 2, height: 16, backgroundColor: C.grayLight, marginLeft: 18 },
  routeInfo: { flex: 1 },
  routeLabel: { fontSize: 11, color: C.gray, fontWeight: '600', textTransform: 'uppercase' },
  routeAddress: { fontSize: 14, color: C.text, fontWeight: '500', marginTop: 2 },
  routeNote: { fontSize: 12, color: C.gray, marginTop: 2 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, paddingBottom: 0 },
  timelineLeft: { alignItems: 'center', width: 28, marginRight: 12 },
  timelineCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.grayLight, alignItems: 'center', justifyContent: 'center',
  },
  timelineCircleDone: { backgroundColor: COLORS.primary },
  timelineCircleCurrent: { backgroundColor: COLORS.accent },
  timelineCircleText: { fontSize: 11, color: COLORS.white, fontWeight: '700' },
  timelineVLine: { width: 2, height: 20, backgroundColor: C.grayLight, marginVertical: 2 },
  timelineVLineDone: { backgroundColor: COLORS.primary },
  timelineContent: { flex: 1, paddingBottom: 12 },
  timelineLabel: { fontSize: 14, color: C.gray },
  timelineLabelDone: { color: C.text, fontWeight: '600' },
  cancelBanner: {
    backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FED7D7', borderRadius: 12, padding: 14,
  },
  cancelTitle: { fontSize: 13, fontWeight: '700', color: COLORS.error, marginBottom: 4 },
  cancelReason: { fontSize: 13, color: '#C53030' },
  actions: { marginHorizontal: 16, marginTop: 20, gap: 10 },
  trackBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  trackBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  chatBtn: {
    backgroundColor: C.white, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  chatBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  reviewBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  reviewBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  reviewedBadge: {
    backgroundColor: '#F0FDF4', borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  reviewedText: { color: COLORS.success, fontSize: 14, fontWeight: '600' },
  cancelBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: COLORS.error, fontSize: 14, fontWeight: '600' },
});
