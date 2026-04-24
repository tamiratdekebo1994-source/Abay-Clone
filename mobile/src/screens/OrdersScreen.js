import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import { orderAPI } from '../services/api';
import { COLORS, ORDER_STATUS_LABELS } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t } from '../utils/i18n';

const FILTERS = [
  { label: 'All', value: '' },
  { label: 'Active', value: 'DRIVER_ASSIGNED,DRIVER_AT_STORE,PICKED_UP,IN_TRANSIT' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED,FAILED' },
];

export default function OrdersScreen({ navigation }) {
  const theme = useSelector((s) => s.settings.theme);
  const C = getColors(theme);
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

  const styles = getStyles(C);

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
        <View style={styles.cardHeader}>
          <Text style={styles.orderNum}>Order #{item.orderNumber}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.en}</Text>
          </View>
        </View>

        <View style={styles.route}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.pickupAddress}</Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: C.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.error }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.deliveryAddress}</Text>
          </View>
        </View>

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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} colors={[COLORS.primary]} />}
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

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters: {
    flexDirection: 'row', backgroundColor: C.white,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: C.grayLight,
  },
  filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: C.grayLighter },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: C.gray },
  filterTextActive: { color: COLORS.white },
  card: {
    backgroundColor: C.white, marginHorizontal: 16, marginTop: 12,
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderNum: { fontSize: 13, fontWeight: '700', color: C.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  route: { marginBottom: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeText: { flex: 1, fontSize: 13, color: C.text },
  routeLine: { width: 2, height: 10, marginLeft: 3, marginVertical: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  footerFee: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  footerDist: { fontSize: 13, color: C.gray },
  footerDate: { fontSize: 12, color: C.gray, flex: 1 },
  reviewBtn: { backgroundColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  reviewBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.online },
  activeText: { fontSize: 11, fontWeight: '700', color: COLORS.success },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyContainer: { flex: 1 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySubtext: { fontSize: 14, color: C.gray, marginTop: 4 },
});
