import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { orderAPI } from '../services/api';
import { COLORS, ORDER_STATUS_LABELS } from '../utils/constants';
import { t } from '../utils/i18n';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'DRIVER_ASSIGNED,DRIVER_AT_STORE,PICKED_UP,IN_TRANSIT' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED,FAILED' },
];

export default function OrdersScreen({ navigation }) {
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
      setTotal(data.data.total);
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

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const renderItem = ({ item }) => {
    const statusInfo = ORDER_STATUS_LABELS[item.status] || { en: item.status, color: COLORS.gray };
    const isActive = ['DRIVER_ASSIGNED', 'DRIVER_AT_STORE', 'PICKED_UP', 'IN_TRANSIT'].includes(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          isActive
            ? navigation.navigate('ActiveDelivery', { orderId: item.id })
            : navigation.navigate('OrderDetail', { orderId: item.id })
        }
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <Text style={styles.orderNum}>Order #{item.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.en}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.pickupAddress}</Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: COLORS.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.error }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.deliveryAddress}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerFee}>ETB {item.driverFee?.toFixed(2)}</Text>
          <Text style={styles.footerDist}>{item.distanceKm?.toFixed(1)} km</Text>
          <Text style={styles.footerDate}>
            {new Date(item.createdAt).toLocaleDateString('en-ET', { month: 'short', day: 'numeric' })}
          </Text>
          {item.status === 'DELIVERED' && !item.review && (
            <TouchableOpacity
              style={styles.reviewBtn}
              onPress={() => navigation.navigate('Review', { orderId: item.id, order: item })}
            >
              <Text style={styles.reviewBtnText}>⭐ Rate</Text>
            </TouchableOpacity>
          )}
          {isActive && (
            <View style={styles.activePill}>
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>Active</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, filter === f.value && styles.filterBtnActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
          onEndReached={() => { if (orders.length < total) load(); }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySubtext}>ምንም ትዕዛዝ የለም</Text>
            </View>
          }
          contentContainerStyle={orders.length === 0 && styles.emptyContainer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.grayLighter,
  },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
  filterTextActive: { color: COLORS.white },
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNum: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  route: { marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeText: { flex: 1, fontSize: 13, color: COLORS.text },
  routeLine: { width: 2, height: 10, marginLeft: 3, marginVertical: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  footerFee: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  footerDist: { fontSize: 13, color: COLORS.gray },
  footerDate: { fontSize: 12, color: COLORS.textLight, flex: 1 },
  reviewBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
  },
  reviewBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.online },
  activeText: { fontSize: 11, fontWeight: '700', color: COLORS.success },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyContainer: { flex: 1 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySubtext: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
});
