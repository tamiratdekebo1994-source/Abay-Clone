import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { orderAPI } from '../services/api';
import { COLORS, ORDER_STATUS_LABELS } from '../utils/constants';
import { getColors } from '../utils/theme';

const FILTERS = [
  { label: 'All',       value: '' },
  { label: 'Active',    value: 'DRIVER_ASSIGNED,DRIVER_AT_STORE,PICKED_UP,IN_TRANSIT' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED,FAILED' },
];

const ACTIVE_STATUSES = new Set(['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT']);

export default function OrdersScreen({ navigation }) {
  const theme = useSelector((s) => s.settings.theme);
  const C = getColors(theme);
  const S = getStyles(C);

  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (reset = false) => {
    try {
      const currentPage = reset ? 1 : page;
      const { data } = await orderAPI.getMyOrders({
        status: filter || undefined,
        page: currentPage,
        limit: 20,
      });
      const fetched = data.data.orders;
      setOrders(reset ? fetched : (prev) => [...prev, ...fetched]);
      setTotal(data.data.pagination.total);
      if (reset) setPage(2);
      else setPage((p) => p + 1);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [filter, page]);

  useEffect(() => {
    setIsLoading(true);
    setPage(1);
    setOrders([]);
    load(true);
  }, [filter]);

  // Earnings summary computed from loaded delivered orders
  const deliveredOrders = filter === 'DELIVERED' || filter === ''
    ? orders.filter((o) => o.status === 'DELIVERED')
    : filter === 'DELIVERED' ? orders : [];

  const summaryEarnings = orders
    .filter((o) => o.status === 'DELIVERED')
    .reduce((sum, o) => sum + (o.driverFee || 0), 0);

  const showSummary = filter === 'DELIVERED' && orders.length > 0;

  const renderItem = ({ item }) => {
    const statusInfo = ORDER_STATUS_LABELS[item.status] || { en: item.status, color: COLORS.gray };
    const isActive = ACTIVE_STATUSES.has(item.status);
    const isDelivered = item.status === 'DELIVERED';
    const isCancelled = item.status === 'CANCELLED' || item.status === 'FAILED';
    const storeName = item.store?.storeName || 'Store';

    return (
      <TouchableOpacity
        style={S.card}
        onPress={() =>
          isActive
            ? navigation.navigate('ActiveDelivery', { orderId: item.id })
            : navigation.navigate('OrderDetail', { orderId: item.id })
        }
        activeOpacity={0.7}
      >
        {/* ── Card header: store name + status ── */}
        <View style={S.cardHeader}>
          <View style={S.storeRow}>
            <Text style={S.storeIcon}>🏪</Text>
            <Text style={S.storeName} numberOfLines={1}>{storeName}</Text>
          </View>
          {isActive && (
            <View style={S.activePill}>
              <View style={S.activeDot} />
              <Text style={S.activeText}>Active</Text>
            </View>
          )}
          {!isActive && (
            <View style={[S.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
              <Text style={[S.statusText, { color: statusInfo.color }]}>{statusInfo.en}</Text>
            </View>
          )}
        </View>

        <Text style={S.orderNum}>Order #{item.orderNumber}</Text>

        {/* ── Route ── */}
        <View style={S.route}>
          <View style={S.routeRow}>
            <View style={[S.routeDot, { backgroundColor: COLORS.primary }]} />
            <Text style={S.routeText} numberOfLines={1}>{item.pickupAddress}</Text>
          </View>
          <View style={[S.routeLine, { backgroundColor: C.border || '#E5E7EB' }]} />
          <View style={S.routeRow}>
            <View style={[S.routeDot, { backgroundColor: COLORS.error }]} />
            <Text style={S.routeText} numberOfLines={1}>{item.deliveryAddress}</Text>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={S.cardFooter}>
          {isDelivered ? (
            <View style={S.earningsBadge}>
              <Text style={S.earningsText}>ETB {item.driverFee?.toFixed(2)}</Text>
            </View>
          ) : (
            <Text style={S.footerFee}>ETB {item.driverFee?.toFixed(2)}</Text>
          )}

          <View style={S.footerChip}>
            <Text style={S.footerChipText}>{item.distanceKm?.toFixed(1)} km</Text>
          </View>

          {item.isFragile && (
            <View style={[S.footerChip, S.fragileChip]}>
              <Text style={S.footerChipText}>⚠️ Fragile</Text>
            </View>
          )}

          {item.requiresRefrigeration && (
            <View style={[S.footerChip, S.coldChip]}>
              <Text style={S.footerChipText}>❄️ Cold</Text>
            </View>
          )}

          <Text style={S.footerDate}>
            {new Date(item.createdAt).toLocaleDateString('en-ET', { month: 'short', day: 'numeric' })}
          </Text>

          {isDelivered && !item.review && (
            <TouchableOpacity
              style={S.reviewBtn}
              onPress={() => navigation.navigate('Review', { orderId: item.id, order: item })}
            >
              <Text style={S.reviewBtnText}>⭐ Rate</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = showSummary ? (
    <View style={S.summaryBar}>
      <View style={S.summaryItem}>
        <Text style={S.summaryVal}>ETB {summaryEarnings.toFixed(0)}</Text>
        <Text style={S.summaryLabel}>Earned</Text>
      </View>
      <View style={S.summaryDivider} />
      <View style={S.summaryItem}>
        <Text style={S.summaryVal}>{orders.length}</Text>
        <Text style={S.summaryLabel}>Trips</Text>
      </View>
      <View style={S.summaryDivider} />
      <View style={S.summaryItem}>
        <Text style={S.summaryVal}>
          ETB {orders.length > 0 ? (summaryEarnings / orders.length).toFixed(0) : '0'}
        </Text>
        <Text style={S.summaryLabel}>Avg / Trip</Text>
      </View>
    </View>
  ) : null;

  return (
    <View style={S.container}>
      {/* ── Green header ── */}
      <SafeAreaView style={S.header} edges={['top']}>
        <Text style={S.headerTitle}>Trips</Text>
      </SafeAreaView>

      {/* ── Filter pills ── */}
      <View style={S.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[S.filterBtn, filter === f.value && S.filterBtnActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[S.filterText, filter === f.value && S.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={S.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              colors={[COLORS.primary]}
            />
          }
          onEndReached={() => { if (orders.length < total) load(); }}
          onEndReachedThreshold={0.3}
          contentContainerStyle={orders.length === 0 ? S.emptyContainer : { paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={S.empty}>
              <Text style={S.emptyEmoji}>📦</Text>
              <Text style={S.emptyTitle}>No orders yet</Text>
              <Text style={S.emptySubtext}>ምንም ትዕዛዝ የለም</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: { backgroundColor: COLORS.primary },
  headerTitle: {
    color: COLORS.white, fontSize: 20, fontWeight: '800',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },

  // Filters
  filters: {
    flexDirection: 'row', backgroundColor: C.white,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border || '#E5E7EB',
  },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.background,
    borderWidth: 1, borderColor: C.border || '#E5E7EB',
  },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: C.gray },
  filterTextActive: { color: COLORS.white },

  // Summary bar (delivered filter)
  summaryBar: {
    flexDirection: 'row', backgroundColor: '#1B4332',
    marginHorizontal: 16, marginTop: 12, borderRadius: 14,
    paddingVertical: 14,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { color: '#FCBF49', fontSize: 16, fontWeight: '800' },
  summaryLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },

  // Card
  card: {
    backgroundColor: C.white, marginHorizontal: 16, marginTop: 12,
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  storeIcon: { fontSize: 16 },
  storeName: { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },
  orderNum: { fontSize: 12, color: C.gray, fontWeight: '500', marginBottom: 12 },

  // Status / active badges
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, flexShrink: 0 },
  statusText: { fontSize: 11, fontWeight: '700' },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  activeText: { fontSize: 11, fontWeight: '700', color: '#15803D' },

  // Route
  route: { marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeText: { flex: 1, fontSize: 13, color: C.text },
  routeLine: { width: 2, height: 10, marginLeft: 3, marginVertical: 2 },

  // Footer
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  footerFee: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  earningsBadge: {
    backgroundColor: '#DCFCE7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
  },
  earningsText: { fontSize: 14, fontWeight: '800', color: '#15803D' },
  footerChip: {
    backgroundColor: C.background, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: StyleSheet.hairlineWidth, borderColor: C.border || '#E5E7EB',
  },
  fragileChip: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  coldChip: { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' },
  footerChipText: { fontSize: 12, color: C.gray, fontWeight: '500' },
  footerDate: { fontSize: 12, color: C.gray, flex: 1, textAlign: 'right' },
  reviewBtn: {
    backgroundColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
  },
  reviewBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  // Empty
  emptyContainer: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySubtext: { fontSize: 14, color: C.gray, marginTop: 4 },
});
