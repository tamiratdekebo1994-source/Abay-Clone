import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useSelector, useDispatch } from 'react-redux';
import { logout, updateDriver } from '../store/authStore';
import { toggleTheme, changeLanguage } from '../store/settingsStore';
import { uploadAPI } from '../services/api';
import { COLORS, TAB_BAR_CLEARANCE } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t } from '../utils/i18n';

const MENU_SECTIONS = [
  {
    items: [
      { id: 'metrics',    icon: '📊', labelKey: 'myMetrics',         screen: null },
      { id: 'incentives', icon: '🎁', labelKey: 'incentivePrograms', screen: null },
      { id: 'resources',  icon: '📚', labelKey: 'resourceCenter',    screen: null },
      { id: 'certs',      icon: '🏅', labelKey: 'certifications',    screen: null },
    ],
  },
  {
    items: [
      { id: 'help',       icon: '❓', labelKey: 'help',            screen: 'HelpSupport' },
      { id: 'license',    icon: '🪪', labelKey: 'driversLicense',  screen: null },
      { id: 'vehicles',   icon: '🚗', labelKey: 'vehicles',        screen: null },
    ],
  },
  {
    items: [
      { id: 'wallet',     icon: '💰', labelKey: 'wallet',   screen: 'Wallet' },
      { id: 'account',    icon: '👤', labelKey: 'account',  screen: null },
      { id: 'settings',   icon: '⚙️',  labelKey: 'settings', screen: null },
    ],
  },
];

export default function MoreScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, driver } = useSelector((s) => s.auth);
  const theme = useSelector((s) => s.settings.theme);
  const lang = useSelector((s) => s.settings.language);
  const C = getColors(theme);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const isDark = theme === 'dark';

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permissionNeededTitle', lang), t('allowPhotoAccessBody', lang));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    try {
      setUploadingPhoto(true);
      const { data } = await uploadAPI.avatar(uri);
      dispatch(updateDriver({ profilePhotoUrl: data.data.avatarUrl }));
    } catch {
      Alert.alert(t('uploadFailedTitle', lang), t('profilePhotoFailedBody', lang));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleItem = (item) => {
    if (item.screen) {
      navigation.navigate(item.screen);
      return;
    }
    if (item.id === 'account') {
      navigation.navigate('Profile');
      return;
    }
    if (item.id === 'settings') {
      showSettings();
      return;
    }
    Alert.alert(t(item.labelKey, lang), t('comingSoon', lang));
  };

  const showSettings = () => {
    Alert.alert(t('settings', lang), t('chooseAnOption', lang), [
      {
        text: isDark ? t('lightMode', lang) : t('darkMode', lang),
        onPress: () => dispatch(toggleTheme()),
      },
      {
        text: lang === 'am' ? '🇬🇧 English' : '🇪🇹 አማርኛ',
        onPress: () => dispatch(changeLanguage(lang === 'am' ? 'en' : 'am')),
      },
      { text: t('cancel', lang), style: 'cancel' },
    ]);
  };

  const handleLogout = () => {
    Alert.alert(t('signOut', lang), t('signOutConfirm', lang), [
      { text: t('cancel', lang), style: 'cancel' },
      { text: t('signOut', lang), style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const initials = user?.fullName
    ? user.fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <View style={[S.root, { backgroundColor: C.background }]}>
      {/* Header */}
      <SafeAreaView style={S.header} edges={['top']}>
        <View style={S.profileRow}>
          <TouchableOpacity style={S.avatarWrap} onPress={pickPhoto} activeOpacity={0.8}>
            {driver?.profilePhotoUrl ? (
              <Image source={{ uri: driver.profilePhotoUrl }} style={S.avatar} />
            ) : (
              <View style={S.avatarFallback}>
                <Text style={S.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={S.avatarEditBadge}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={S.avatarEditIcon}>📷</Text>
              }
            </View>
          </TouchableOpacity>
          <View style={S.profileInfo}>
            <Text style={S.profileName}>{user?.fullName?.toUpperCase() || t('driverFallback', lang)}</Text>
            <Text style={S.profilePhone}>{user?.phone}</Text>
            {driver?.status && (
              <View style={[S.statusPill, driver.status === 'ONLINE' && S.statusOnline]}>
                <Text style={S.statusPillText}>
                  {driver.status === 'ONLINE' ? `🟢 ${t('online', lang)}` : `⚫ ${t('offline', lang)}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Nav app selector */}
        <TouchableOpacity
          style={S.navAppRow}
          onPress={() => Alert.alert(t('navAppTitle', lang), t('navAppComingSoonBody', lang))}
        >
          <Text style={S.navAppIcon}>🧭</Text>
          <Text style={S.navAppText}>{t('selectNavApp', lang)}</Text>
          <Text style={S.chevron}>›</Text>
        </TouchableOpacity>

        {/* ── Driver stats strip ── */}
        {driver && (
          <View style={S.statsStrip}>
            <View style={S.statCell}>
              <Text style={S.statVal}>{driver.totalDeliveries ?? 0}</Text>
              <Text style={S.statKey}>{t('trips', lang)}</Text>
            </View>
            <View style={S.statLine} />
            <View style={S.statCell}>
              {driver.rating != null ? (
                <Text style={S.statVal}>⭐ {driver.rating.toFixed(1)}</Text>
              ) : (
                <Text style={S.statVal}>—</Text>
              )}
              <Text style={S.statKey}>{t('rating', lang)}</Text>
            </View>
            <View style={S.statLine} />
            <View style={S.statCell}>
              <Text style={S.statVal}>
                {(driver.deliveryStreak ?? 0) >= 3 ? `🔥 ${driver.deliveryStreak}` : driver.deliveryStreak ?? 0}
              </Text>
              <Text style={S.statKey}>{t('dayStreak', lang)}</Text>
            </View>
            <View style={S.statLine} />
            <View style={S.statCell}>
              <Text style={S.statVal}>ETB {driver.totalEarnings?.toFixed(0) ?? '0'}</Text>
              <Text style={S.statKey}>{t('earned', lang)}</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* Menu */}
      <ScrollView style={S.scroll} showsVerticalScrollIndicator={false}>
        {MENU_SECTIONS.map((section, si) => (
          <View key={si} style={[S.section, { backgroundColor: C.white }]}>
            {section.items.map((item, ii) => (
              <TouchableOpacity
                key={item.id}
                style={[S.menuItem, ii < section.items.length - 1 && S.menuItemBorder]}
                onPress={() => handleItem(item)}
                activeOpacity={0.7}
              >
                <Text style={S.menuIcon}>{item.icon}</Text>
                <Text style={[S.menuLabel, { color: C.text }]}>{t(item.labelKey, lang)}</Text>
                <Text style={[S.chevron, { color: C.gray }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Sign Out */}
        <TouchableOpacity style={[S.signOutBtn, { backgroundColor: C.white }]} onPress={handleLogout}>
          <Text style={S.menuIcon}>🚪</Text>
          <Text style={S.signOutText}>{t('signOut', lang)}</Text>
        </TouchableOpacity>

        <Text style={[S.version, { color: C.gray }]}>ET Spark Driver v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  header: { backgroundColor: COLORS.accent, paddingBottom: 0 },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  avatarWrap: { marginRight: 16, position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(27,67,50,0.3)' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditIcon: { fontSize: 11 },
  avatarFallback: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(27,67,50,0.15)',
    borderWidth: 3, borderColor: 'rgba(27,67,50,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: COLORS.primary, fontSize: 26, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { color: COLORS.primary, fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  profilePhone: { color: 'rgba(27,67,50,0.7)', fontSize: 13, marginTop: 2 },
  statusPill: {
    alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: 'rgba(27,67,50,0.12)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
  },
  statusOnline: { backgroundColor: 'rgba(40,167,69,0.3)' },
  statusPillText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },

  navAppRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(27,67,50,0.10)',
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  navAppIcon: { fontSize: 20, marginRight: 12 },
  navAppText: { flex: 1, color: COLORS.primary, fontSize: 14, fontWeight: '600' },

  statsStrip: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 16,
    backgroundColor: 'rgba(27,67,50,0.08)', borderRadius: 14, paddingVertical: 14,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { color: COLORS.primary, fontSize: 14, fontWeight: '800' },
  statKey: { color: 'rgba(27,67,50,0.55)', fontSize: 10, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  statLine: { width: 1, backgroundColor: 'rgba(27,67,50,0.15)' },

  scroll: { flex: 1, paddingTop: 16 },

  section: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 16,
  },
  menuItemBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#EBEBEB' },
  menuIcon: { fontSize: 20, width: 32 },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  chevron: { fontSize: 22, color: COLORS.gray, fontWeight: '300' },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  signOutText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.error },

  version: { textAlign: 'center', fontSize: 12, paddingBottom: TAB_BAR_CLEARANCE, marginTop: 4 },
});
