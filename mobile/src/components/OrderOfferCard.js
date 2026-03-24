import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../utils/constants';

export default function OrderOfferCard({ order, onAccept }) {
  const [timeLeft, setTimeLeft] = useState(30);
  const progressAnim = new Animated.Value(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 30000,
      useNativeDriver: false,
    }).start();

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.card}>
      {/* Timer bar */}
      <Animated.View style={[styles.timerBar, {
        width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]} />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.fee}>ETB {order.driverFee?.toFixed(0)}</Text>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{timeLeft}s</Text>
          </View>
        </View>

        <View style={styles.routeInfo}>
          <View style={styles.routeItem}>
            <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
            <View style={styles.routeText}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>
                {order.store?.storeName || order.pickupAddress}
              </Text>
            </View>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeItem}>
            <View style={[styles.dot, { backgroundColor: COLORS.error }]} />
            <View style={styles.routeText}>
              <Text style={styles.routeLabel}>Delivery</Text>
              <Text style={styles.routeAddress} numberOfLines={1}>
                {order.deliveryAddress}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaItem}>📏 {order.distanceKm?.toFixed(1)} km</Text>
          {order.isFragile && <Text style={styles.metaItem}>⚠️ Fragile</Text>}
          {order.requiresRefrigeration && <Text style={styles.metaItem}>❄️ Cold</Text>}
        </View>

        <TouchableOpacity
          style={[styles.acceptBtn, timeLeft === 0 && styles.acceptBtnDisabled]}
          onPress={onAccept}
          disabled={timeLeft === 0}
        >
          <Text style={styles.acceptBtnText}>
            {timeLeft > 0 ? 'Accept Delivery / ትዕዛዝ ተቀበል' : 'Expired'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white, borderRadius: 14,
    marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
  },
  timerBar: {
    height: 4, backgroundColor: COLORS.accent,
    position: 'absolute', top: 0, left: 0,
  },
  content: { padding: 16, paddingTop: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  fee: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  timerBadge: {
    backgroundColor: '#FEF3C7', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 20,
  },
  timerText: { fontWeight: '700', color: '#92400E', fontSize: 13 },
  routeInfo: { marginBottom: 12 },
  routeItem: { flexDirection: 'row', alignItems: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 3, marginRight: 10 },
  routeLine: { width: 1, height: 16, backgroundColor: COLORS.border, marginLeft: 4, marginVertical: 2 },
  routeText: { flex: 1 },
  routeLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600', textTransform: 'uppercase' },
  routeAddress: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  meta: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  metaItem: { fontSize: 13, color: COLORS.gray },
  acceptBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  acceptBtnDisabled: { backgroundColor: COLORS.gray },
  acceptBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
