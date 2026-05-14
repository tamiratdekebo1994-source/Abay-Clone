import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { notificationAPI } from '../services/api';
import { COLORS } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t } from '../utils/i18n';

const TYPE_ICONS = {
  ORDER_NEW: '🆕', ORDER_ACCEPTED: '✅', ORDER_STATUS: '📦',
  ORDER_DELIVERED: '🎉', ORDER_CANCELLED: '❌',
  DRIVER_STATUS: '🚗', WALLET: '💰', CHAT: '💬', SYSTEM: '📢',
};

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsScreen() {
  const theme = useSelector((s) => s.settings.theme);
  const C = getColors(theme);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      const { data } = await notificationAPI.list({ limit: 30 });
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
    await notificationAPI.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleTap = async (item) => {
    if (!item.isRead) {
      await notificationAPI.markRead(item.id);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const styles = getStyles(C, theme);

  const renderItem = ({ item }) => {
    const icon = TYPE_ICONS[item.type] || '🔔';
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
          <Text style={styles.body} numberOfLines={2}>{item.bodyAm || item.body}</Text>
          <Text style={styles.time}>{getTimeAgo(item.createdAt)}</Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* ── Green header ── */}
      <SafeAreaView style={styles.header} edges={['top']}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>✓ Mark all read</Text>
            </TouchableOpacity>
          )}
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[COLORS.primary]} />
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

const getStyles = (C, theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },

  // Header
  header: { backgroundColor: COLORS.primary },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
  },
  headerTitle: { flex: 1, color: COLORS.white, fontSize: 20, fontWeight: '800' },
  markAllBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10, marginRight: 8,
  },
  markAllText: { color: COLORS.white, fontWeight: '600', fontSize: 12 },
  badge: {
    backgroundColor: COLORS.white, borderRadius: 10,
    minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: COLORS.primary, fontSize: 11, fontWeight: '800' },
  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.grayLight,
  },
  itemUnread: { backgroundColor: theme === 'dark' ? '#0F2419' : '#F0FDF4' },
  iconBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.grayLighter,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, flexShrink: 0,
  },
  iconBadgeUnread: { backgroundColor: '#DCFCE7' },
  icon: { fontSize: 20 },
  content: { flex: 1 },
  title: { fontSize: 14, color: C.text, marginBottom: 3 },
  titleUnread: { fontWeight: '700', color: COLORS.primary },
  body: { fontSize: 13, color: C.gray, lineHeight: 18 },
  time: { fontSize: 11, color: C.gray, marginTop: 4 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary, marginTop: 6, marginLeft: 8,
  },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyContainer: { flex: 1 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.text },
  emptySubtext: { fontSize: 14, color: C.gray, marginTop: 4 },
});
