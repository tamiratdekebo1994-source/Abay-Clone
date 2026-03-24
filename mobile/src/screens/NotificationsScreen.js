import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { COLORS } from '../utils/constants';
import { t } from '../utils/i18n';

const API_URL_BASE = require('../services/api').default?.defaults?.baseURL || '';

const TYPE_ICONS = {
  ORDER_NEW:       '🆕',
  ORDER_ACCEPTED:  '✅',
  ORDER_STATUS:    '📦',
  ORDER_DELIVERED: '🎉',
  ORDER_CANCELLED: '❌',
  DRIVER_STATUS:   '🚗',
  WALLET:          '💰',
  CHAT:            '💬',
  SYSTEM:          '📢',
};

async function fetchNotifications(token, page = 1) {
  const res = await fetch(
    `${API_URL_BASE.replace('/api', '')}/api/notifications?page=${page}&limit=30`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

async function markAllRead(token) {
  await fetch(`${API_URL_BASE.replace('/api', '')}/api/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function markOneRead(token, id) {
  await fetch(`${API_URL_BASE.replace('/api', '')}/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
}

import { useSelector } from 'react-redux';
import * as SecureStore from 'expo-secure-store';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const token = await SecureStore.getItemAsync('accessToken');
      const data = await fetchNotifications(token);
      if (data.success) {
        setNotifications(data.data.notifications);
        setUnreadCount(data.data.unreadCount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handleMarkAllRead = async () => {
    const token = await SecureStore.getItemAsync('accessToken');
    await markAllRead(token);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleTap = async (item) => {
    if (!item.isRead) {
      const token = await SecureStore.getItemAsync('accessToken');
      await markOneRead(token, item.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const renderItem = ({ item }) => {
    const icon = TYPE_ICONS[item.type] || '🔔';
    const timeAgo = getTimeAgo(item.createdAt);
    return (
      <TouchableOpacity
        style={[styles.item, !item.isRead && styles.itemUnread]}
        onPress={() => handleTap(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconBadge, !item.isRead && styles.iconBadgeUnread]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, !item.isRead && styles.titleUnread]} numberOfLines={1}>
            {item.titleAm || item.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {item.bodyAm || item.body}
          </Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header actions */}
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
          <Text style={styles.markAllText}>✓ Mark all as read ({unreadCount})</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyText}>{t('notifications')} — ምንም የለም</Text>
            <Text style={styles.emptySubtext}>No notifications yet</Text>
          </View>
        }
        contentContainerStyle={notifications.length === 0 && styles.emptyContainer}
      />
    </View>
  );
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markAllBtn: {
    backgroundColor: COLORS.primaryLight,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  markAllText: { color: COLORS.white, fontWeight: '600', fontSize: 14 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayLight,
  },
  itemUnread: { backgroundColor: '#F0FDF4' },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  iconBadgeUnread: { backgroundColor: '#DCFCE7' },
  icon: { fontSize: 20 },
  content: { flex: 1 },
  title: { fontSize: 14, color: COLORS.text, marginBottom: 3 },
  titleUnread: { fontWeight: '700', color: COLORS.primary },
  body: { fontSize: 13, color: COLORS.gray, lineHeight: 18 },
  time: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary, marginTop: 6, marginLeft: 8,
  },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyContainer: { flex: 1 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySubtext: { fontSize: 14, color: COLORS.gray, marginTop: 4 },
});
