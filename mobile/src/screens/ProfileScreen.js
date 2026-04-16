import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authStore';
import { COLORS, VEHICLE_TYPES } from '../utils/constants';
import { t, setLanguage, getLanguage } from '../utils/i18n';

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, driver } = useSelector((state) => state.auth);
  const [lang, setLang] = useState(getLanguage());

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

  return (
    <ScrollView style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.fullName?.charAt(0) || 'A'}</Text>
        </View>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        {driver && (
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(driver.status) }]}>
            <Text style={styles.statusBadgeText}>{driver.status}</Text>
          </View>
        )}
      </View>

      {/* Stats */}
      {driver && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{driver.totalDeliveries}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>⭐ {driver.rating?.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>ETB {driver.totalEarnings?.toFixed(0)}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
        </View>
      )}

      {/* Vehicle Info */}
      {driver && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🚗 Vehicle Information</Text>
          <InfoRow label="Type" value={VEHICLE_TYPES.find((v) => v.value === driver.vehicleType)?.label || driver.vehicleType} />
          <InfoRow label="Plate" value={driver.vehiclePlate} />
          <InfoRow label="Model" value={driver.vehicleModel} />
          <InfoRow label="Color" value={driver.vehicleColor} />
          <InfoRow label="Year" value={String(driver.vehicleYear)} />
          <InfoRow label="License" value={driver.licenseNumber} />
        </View>
      )}

      {/* Menu Items */}
      <View style={styles.menu}>
        <MenuButton icon="📜" label={`${t('deliveryHistory', lang)} / Delivery History`} onPress={() => navigation.navigate('Orders')} />
        <MenuButton icon="💰" label={`${t('earnings', lang)}`} onPress={() => navigation.navigate('Earnings')} />
        <MenuButton icon="🔔" label={`${t('notifications', lang)}`} onPress={() => navigation.navigate('Notifications')} />
        <MenuButton icon="❓" label={`${t('helpSupport', lang)}`} onPress={() => navigation.navigate('HelpSupport')} />

        {/* Language Toggle */}
        <TouchableOpacity style={styles.menuItem} onPress={toggleLanguage}>
          <Text style={styles.menuIcon}>🌐</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuLabel}>{t('language', lang)}</Text>
            <Text style={styles.menuSub}>{lang === 'am' ? 'አማርኛ (ቀይ ወደ English)' : 'English (switch to አማርኛ)'}</Text>
          </View>
          <View style={[styles.langBadge, { backgroundColor: lang === 'am' ? COLORS.primary : COLORS.accent }]}>
            <Text style={[styles.langBadgeText, { color: lang === 'am' ? COLORS.white : COLORS.primary }]}>
              {lang === 'am' ? 'አማ' : 'EN'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>🚪 {t('logout', lang)}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>ET Spark Driver v1.0.0 • 🇪🇹 Made in Ethiopia</Text>
      </View>
    </ScrollView>
  );
}

const InfoRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const MenuButton = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <Text style={styles.menuIcon}>{icon}</Text>
    <Text style={styles.menuLabel}>{label}</Text>
    <Text style={styles.menuArrow}>›</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
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
    flexDirection: 'row', backgroundColor: COLORS.white,
    margin: 16, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  statLabel: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  card: {
    backgroundColor: COLORS.white, margin: 16, marginTop: 0,
    borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  infoLabel: { fontSize: 14, color: COLORS.gray },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  menu: { backgroundColor: COLORS.white, margin: 16, marginTop: 0, borderRadius: 12, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight },
  menuIcon: { fontSize: 20, marginRight: 12 },
  menuLabel: { fontSize: 15, color: COLORS.text },
  menuSub: { fontSize: 11, color: COLORS.gray, marginTop: 1 },
  menuArrow: { fontSize: 20, color: COLORS.gray },
  langBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  langBadgeText: { fontSize: 12, fontWeight: '700' },
  logoutBtn: {
    margin: 16, backgroundColor: '#FEE2E2',
    borderRadius: 12, padding: 16, alignItems: 'center',
  },
  logoutText: { color: COLORS.error, fontSize: 16, fontWeight: '700' },
  footer: { alignItems: 'center', paddingVertical: 24 },
  footerText: { color: COLORS.gray, fontSize: 12 },
});
