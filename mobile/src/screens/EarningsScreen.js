import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { driverAPI } from '../services/api';
import { COLORS } from '../utils/constants';

const PERIODS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
];

export default function EarningsScreen() {
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadEarnings = async () => {
    try {
      const { data: res } = await driverAPI.getEarnings(period);
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadEarnings();
  }, [period]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEarnings(); }} colors={[COLORS.primary]} />}
    >
      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.value}
            style={[styles.periodBtn, period === p.value && styles.periodBtnActive]}
            onPress={() => setPeriod(p.value)}
          >
            <Text style={[styles.periodBtnText, period === p.value && styles.periodBtnTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Earnings / ጠቅላላ ገቢ</Text>
        <Text style={styles.summaryAmount}>ETB {data?.total?.toFixed(2) || '0.00'}</Text>
        <View style={styles.summaryStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{data?.deliveries || 0}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>ETB {data?.averagePerDelivery?.toFixed(0) || 0}</Text>
            <Text style={styles.statLabel}>Avg per Trip</Text>
          </View>
        </View>
      </View>

      {/* Tips */}
      <View style={styles.tipsCard}>
        <Text style={styles.tipsTitle}>💡 Tips to Earn More</Text>
        <Text style={styles.tip}>• Stay online during peak hours (7-9am, 12-2pm, 6-8pm)</Text>
        <Text style={styles.tip}>• Accept deliveries in busy areas (Bole, Kazanchis, Piassa)</Text>
        <Text style={styles.tip}>• Maintain high rating for priority dispatch</Text>
      </View>

      {/* Earnings List */}
      <View style={styles.listSection}>
        <Text style={styles.listTitle}>Delivery History / የማድረስ ታሪክ</Text>
        {data?.earnings?.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No deliveries in this period</Text>
            <Text style={styles.emptyTextAm}>በዚህ ጊዜ ምንም ማድረስ የለም</Text>
          </View>
        ) : (
          data?.earnings?.map((earning) => (
            <View key={earning.id} style={styles.earningRow}>
              <View style={styles.earningLeft}>
                <Text style={styles.earningOrderNum}>#{earning.order?.orderNumber}</Text>
                <Text style={styles.earningAddress} numberOfLines={1}>
                  {earning.order?.deliveryAddress}
                </Text>
                <Text style={styles.earningDistance}>
                  {earning.order?.distanceKm?.toFixed(1)} km
                </Text>
              </View>
              <View style={styles.earningRight}>
                <Text style={styles.earningAmount}>ETB {earning.amount?.toFixed(2)}</Text>
                <Text style={styles.earningDate}>
                  {new Date(earning.createdAt).toLocaleDateString('en-ET')}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  periodSelector: {
    flexDirection: 'row', padding: 16, gap: 8,
  },
  periodBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10,
    backgroundColor: COLORS.white, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  periodBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  periodBtnTextActive: { color: COLORS.white },
  summaryCard: {
    margin: 16, backgroundColor: COLORS.primary,
    borderRadius: 16, padding: 24, alignItems: 'center',
  },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  summaryAmount: { color: COLORS.accent, fontSize: 40, fontWeight: '800', marginVertical: 8 },
  summaryStats: { flexDirection: 'row', marginTop: 16, width: '100%' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: COLORS.white, fontSize: 22, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  tipsCard: {
    margin: 16, marginTop: 0, backgroundColor: '#E8F5E9',
    borderRadius: 12, padding: 16,
  },
  tipsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 8 },
  tip: { fontSize: 13, color: COLORS.text, marginBottom: 4 },
  listSection: { margin: 16, marginTop: 0 },
  listTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  emptyState: { alignItems: 'center', padding: 32, backgroundColor: COLORS.white, borderRadius: 12 },
  emptyText: { fontSize: 16, color: COLORS.gray },
  emptyTextAm: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
  earningRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 10, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  earningLeft: { flex: 1, marginRight: 12 },
  earningOrderNum: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  earningAddress: { fontSize: 13, color: COLORS.text, marginTop: 2 },
  earningDistance: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  earningRight: { alignItems: 'flex-end' },
  earningAmount: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  earningDate: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
});
