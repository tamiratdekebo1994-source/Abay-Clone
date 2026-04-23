import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authStore';
import { toggleTheme } from '../store/settingsStore';
import { COLORS, VEHICLE_TYPES } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t, setLanguage, getLanguage } from '../utils/i18n';

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, driver } = useSelector((state) => state.auth);
  const theme = useSelector((state) => state.settings.theme);
  const C = getColors(theme);
  const [lang, setLang] = useState(getLanguage());
  const [vehicleExpanded, setVehicleExpanded] = useState(false);

  const handleLogout = () => {
    Alert.alert(t('logout'), t('confirm') + '?', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('logout'), style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const toggleLanguage = () => {
    const newLang = lang === 'am' ? 'en' : 'am';
    setLanguage(newLang);
    setLang(newLang);
  };

  const getStatusColor = (status) => {
    const colors = {
      APPROVED: COLORS.success, ONLINE: COLORS.online,
      PENDING: COLORS.warning, SUSPENDED: COLORS.error, OFFLINE: COLORS.gray,
    };
    return colors[status] || COLORS.gray;
  };

  const S = getStyles(C, theme);

  return (
    <View style={S.container}>
      <ScrollView contentContainerStyle={S.contentContainer}>

        {/* Profile Header */}
        <View style={S.header}>
          <View style={S.avatar}>
            <Text style={S.avatarText}>{user?.fullName?.charAt(0) || 'A'}</Text>
          </View>
          <Text style={S.name}>{user?.fullName}</Text>
          <Text style={S.phone}>{user?.phone}</Text>
          {driver && (
            <View style={[S.statusBadge, { backgroundColor: getStatusColor(driver.status) }]}>
              <Text style={S.statusBadgeText}>{driver.status}</Text>
            </View>
          )}
        </View>

        {/* Stats */}
        {driver && (
          <View style={S.statsRow}>
            <View style={S.statItem}>
              <Text style={S.statValue}>{driver.totalDeliveries}</Text>
              <Text style={S.statLabel}>Deliveries</Text>
            </View>
            <View style={S.statDivider} />
            <View style={S.statItem}>
              <Text style={S.statValue}>⭐ {driver.rating?.toFixed(1)}</Text>
              <Text style={S.statLabel}>Rating</Text>
            </View>
            <View style={S.statDivider} />
            <View style={S.statItem}>
              <Text style={S.statValue}>ETB {driver.totalEarnings?.toFixed(0)}</Text>
              <Text style={S.statLabel}>Total Earned</Text>
            </View>
          </View>
        )}

        {/* Vehicle Info — collapsible */}
        {driver && (
          <View style={S.menu}>
            <TouchableOpacity style={S.menuItem} onPress={() => setVehicleExpanded(!vehicleExpanded)}>
              <Text style={S.menuIcon}>🚗</Text>
              <Text style={[S.menuLabel, { flex: 1 }]}>Vehicle Information</Text>
              <Text style={S.menuArrow}>{vehicleExpanded ? '⌄' : '›'}</Text>
            </TouchableOpacity>
            {vehicleExpanded && (
              <View style={S.vehicleDetails}>
                <InfoRow label="Type" value={VEHICLE_TYPES.find((v) => v.value === driver.vehicleType)?.label || driver.vehicleType} C={C} />
                <InfoRow label="Plate" value={driver.vehiclePlate} C={C} />
                <InfoRow label="Model" value={driver.vehicleModel} C={C} />
                <InfoRow label="Color" value={driver.vehicleColor} C={C} />
                <InfoRow label="Year" value={String(driver.vehicleYear)} C={C} />
                <InfoRow label="License" value={driver.licenseNumber} C={C} />
              </View>
            )}
          </View>
        )}

        {/* Menu Items */}
        <View style={S.menu}>
          <MenuButton icon="📜" label={`${t('deliveryHistory', lang)} / Delivery History`} onPress={() => navigation.navigate('Orders')} C={C} />
          <MenuButton icon="💰" label={t('earnings', lang)} onPress={() => navigation.navigate('Earnings')} C={C} />
          <MenuButton icon="🔔" label={t('notifications', lang)} onPress={() => navigation.navigate('Notifications')} C={C} />
          <MenuButton icon="❓" label={t('helpSupport', lang)} onPress={() => navigation.navigate('HelpSupport')} C={C} />

          {/* Theme Toggle */}
          <TouchableOpacity style={S.menuItem} onPress={() => dispatch(toggleTheme())}>
            <Text style={S.menuIcon}>{theme === 'dark' ? '🌙' : '☀️'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.menuLabel}>Theme / ገጽታ</Text>
              <Text style={S.menuSub}>{theme === 'dark' ? 'Dark Mode — tap for Light' : 'Light Mode — tap for Dark'}</Text>
            </View>
            <View style={[S.badge, { backgroundColor: theme === 'dark' ? '#333' : COLORS.primary }]}>
              <Text style={[S.badgeText, { color: COLORS.white }]}>
                {theme === 'dark' ? '🌙' : '☀️'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Language Toggle */}
          <TouchableOpacity style={S.menuItem} onPress={toggleLanguage}>
            <Text style={S.menuIcon}>🌐</Text>
            <View style={{ flex: 1 }}>
              <Text style={S.menuLabel}>{t('language', lang)}</Text>
              <Text style={S.menuSub}>{lang === 'am' ? 'አማርኛ (ቀይ ወደ English)' : 'English (switch to አማርኛ)'}</Text>
            </View>
            <View style={[S.badge, { backgroundColor: lang === 'am' ? COLORS.primary : COLORS.accent }]}>
              <Text style={[S.badgeText, { color: lang === 'am' ? COLORS.white : COLORS.primary }]}>
                {lang === 'am' ? 'አማ' : 'EN'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={S.logoutBtn} onPress={handleLogout}>
          <Text style={S.logoutText}>🚪 {t('logout', lang)}</Text>
        </TouchableOpacity>

        <View style={S.footer}>
          <Text style={S.footerText}>Fetno v1.0.0 • 🇪🇹 Made in Ethiopia</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const InfoRow = ({ label, value, C }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.grayLight }}>
    <Text style={{ fontSize: 14, color: C.gray }}>{label}</Text>
    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text }}>{value}</Text>
  </View>
);

const MenuButton = ({ icon, label, onPress, C }) => (
  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.grayLight }} onPress={onPress}>
    <Text style={{ fontSize: 20, marginRight: 12 }}>{icon}</Text>
    <Text style={{ fontSize: 15, color: C.text, flex: 1 }}>{label}</Text>
    <Text style={{ fontSize: 20, color: C.gray }}>›</Text>
  </TouchableOpacity>
);

const getStyles = (C, theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  contentContainer: { paddingBottom: 100 },
  header: {
    backgroundColor: COLORS.primary, alignItems: 'center',
    paddingVertical: 40, paddingHorizontal: 24,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: COLORS.primary },
  name: { color: COLORS.white, fontSize: 22, fontWeight: '700' },
  phone: { color: 'rgba(255,255,255,0.8)', fontSize: 15, marginTop: 4 },
  statusBadge: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20 },
  statusBadgeText: { color: COLORS.white, fontSize: 13, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row', backgroundColor: C.white,
    margin: 16, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, color: C.gray, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: C.border },
  menu: {
    backgroundColor: C.white, margin: 16, marginTop: 0,
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.grayLight },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuLabel: { fontSize: 15, color: C.text },
  menuSub: { fontSize: 11, color: C.gray, marginTop: 1 },
  menuArrow: { fontSize: 20, color: C.gray },
  vehicleDetails: { paddingHorizontal: 16, paddingBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  logoutBtn: {
    margin: 16, backgroundColor: theme === 'dark' ? '#2A1A1A' : '#FEE2E2',
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  logoutText: { color: COLORS.error, fontSize: 16, fontWeight: '700' },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: C.gray, fontSize: 12 },
});
