import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Vibration,
} from 'react-native';
import { COLORS } from '../utils/constants';

export default function OrderOfferCard({ order, onAccept, onDecline, onExpire }) {
  const TIMER_DURATION = order.timeoutSeconds || 30;
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const urgencyAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Vibrate on arrival
    Vibration.vibrate([0, 80, 60, 80]);

    // Progress bar animation
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: TIMER_DURATION * 1000,
      useNativeDriver: false,
    }).start();

    // Countdown
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        if (next <= 5 && next > 0) {
          // Urgency pulse at last 5 seconds
          Animated.sequence([
            Animated.timing(urgencyAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
            Animated.timing(urgencyAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
          ]).start();
          Vibration.vibrate(40);
        }
        if (next <= 0) {
          clearInterval(interval);
          onExpire?.();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAccept = () => {
    Vibration.vibrate([0, 60, 40, 60]);
    onAccept?.();
  };

  const handleDecline = () => {
    Vibration.vibrate(30);
    // Shake animation
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start(() => onDecline?.());
  };

  const urgency = timeLeft <= 5 ? 'critical' : timeLeft <= 10 ? 'warning' : 'normal';
  const timerColor = urgency === 'critical' ? '#EF4444' : urgency === 'warning' ? '#F59E0B' : COLORS.primary;

  const itemCount = order.items?.length ?? order.itemCount ?? null;
  const storeName = order.store?.storeName || order.storeName || 'Store';
  const pay = order.driverFee?.toFixed(2) ?? '0.00';
  const distanceKm = order.distanceKm?.toFixed(1) ?? '–';

  return (
    <Animated.View style={[styles.card, { transform: [{ translateX: shakeAnim }] }]}>

      {/* ── Timer bar ── */}
      <View style={styles.timerTrack}>
        <Animated.View style={[styles.timerFill, {
          backgroundColor: timerColor,
          width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }]} />
      </View>

      <View style={styles.content}>

        {/* ── Header: pay + timer ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.payLabel}>Delivery pay</Text>
            <Text style={styles.pay}>ETB {pay}</Text>
          </View>
          <Animated.View style={[styles.timerBadge,
            { backgroundColor: urgency === 'critical' ? '#FEE2E2' : urgency === 'warning' ? '#FEF3C7' : '#F0FDF4' },
            { transform: [{ scale: urgencyAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] },
          ]}>
            <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}s</Text>
          </Animated.View>
        </View>

        {/* ── Stats row: distance · items ── */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statIcon}>📏</Text>
            <Text style={styles.statText}>{distanceKm} km</Text>
          </View>
          {itemCount !== null && (
            <View style={styles.statChip}>
              <Text style={styles.statIcon}>📦</Text>
              <Text style={styles.statText}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
            </View>
          )}
          {order.isFragile && (
            <View style={styles.statChip}>
              <Text style={styles.statIcon}>⚠️</Text>
              <Text style={styles.statText}>Fragile</Text>
            </View>
          )}
          {order.requiresRefrigeration && (
            <View style={styles.statChip}>
              <Text style={styles.statIcon}>❄️</Text>
              <Text style={styles.statText}>Cold</Text>
            </View>
          )}
        </View>

        {/* ── Route ── */}
        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>PICKUP</Text>
              <Text style={styles.routeAddr} numberOfLines={1}>{storeName}</Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>DELIVER TO</Text>
              <Text style={styles.routeAddr} numberOfLines={1}>{order.deliveryAddress}</Text>
            </View>
          </View>
        </View>

        {/* ── Accept / Decline ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.declineBtn}
            onPress={handleDecline}
            disabled={timeLeft === 0}
            activeOpacity={0.8}
          >
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptBtn, timeLeft === 0 && styles.btnDisabled]}
            onPress={handleAccept}
            disabled={timeLeft === 0}
            activeOpacity={0.85}
          >
            <Text style={styles.acceptBtnText}>
              {timeLeft > 0 ? 'Accept' : 'Expired'}
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18, marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 6,
  },

  timerTrack: { height: 5, backgroundColor: '#E5E7EB', width: '100%' },
  timerFill: { height: 5, borderRadius: 0 },

  content: { padding: 18 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  payLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  pay: { fontSize: 28, fontWeight: '900', color: '#111827', letterSpacing: -0.5 },

  timerBadge: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  timerText: { fontSize: 16, fontWeight: '900' },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  statIcon: { fontSize: 12 },
  statText: { fontSize: 12, fontWeight: '600', color: '#374151' },

  route: { marginBottom: 18 },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  routeLine: { width: 2, height: 18, backgroundColor: '#E5E7EB', marginLeft: 4, marginVertical: 3 },
  routeLabel: { fontSize: 10, color: '#9CA3AF', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  routeAddr: { fontSize: 14, color: '#111827', fontWeight: '600', marginTop: 1 },

  actions: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1, borderRadius: 50, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  declineBtnText: { fontSize: 15, fontWeight: '700', color: '#6B7280' },
  acceptBtn: {
    flex: 2, borderRadius: 50, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  acceptBtnText: { fontSize: 15, fontWeight: '900', color: COLORS.white, letterSpacing: 0.5 },
  btnDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0 },
});
