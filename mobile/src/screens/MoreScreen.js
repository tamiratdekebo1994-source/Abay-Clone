import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useSelector, useDispatch } from 'react-redux';
import { logout, updateDriver } from '../store/authStore';
import { toggleTheme } from '../store/settingsStore';
import { uploadAPI } from '../services/api';
import { COLORS } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t, setLanguage, getLanguage } from '../utils/i18n';

const MENU_SECTIONS = [
  {
    items: [
      { id: 'metrics',    icon: '📊', label: 'My Metrics',              screen: null },
      { id: 'incentives', icon: '🎁', label: 'Incentive Programs',      screen: null },
      { id: 'resources',  icon: '📚', label: 'Resource Center',         screen: null },
      { id: 'certs',      icon: '🏅', label: 'Certifications',          screen: null },
    ],
  },
  {
    items: [
      { id: 'help',       icon: '❓', label: 'Help',                    screen: 'HelpSupport' },
      { id: 'license',    icon: '🪪', label: "Driver's License",        screen: null },
      { id: 'vehicles',   icon: '🚗', label: 'Vehicles',                screen: null },
    ],
  },
  {
    items: [
      { id: 'account',    icon: '👤', label: 'Account',                 screen: null },
      { id: 'settings',   icon: '⚙️',  label: 'Settings',               screen: null },
    ],
  },
];

export default function MoreScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, driver } = useSelector((s) => s.auth);
  const theme = useSelector((s) => s.settings.theme);
  const C = getColors(theme);
  const [lang, setLang] = useState(getLanguage());
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const isDark = theme === 'dark';

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to update your profile picture.');
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
      Alert.alert('Upload failed', 'Could not update your profile photo. Try again.');
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
      Alert.alert('Account', `Name: ${user?.fullName}\nPhone: ${user?.phone}\nRole: ${user?.role}`);
      return;
    }
    if (item.id === 'settings') {
      showSettings();
      return;
    }
    Alert.alert(item.label, 'Coming soon / 近日公開');
  };

  const showSettings = () => {
    Alert.alert('Settings / ቅንብሮች', 'Choose an option', [
      {
        text: isDark ? '☀️ Light Mode' : '🌙 Dark Mode',
        onPress: () => dispatch(toggleTheme()),
      },
      {
        text: lang === 'am' ? '🇬🇧 English' : '🇪🇹 አማርኛ',
        onPress: () => {
          const next = lang === 'am' ? 'en' : 'am';
          setLanguage(next);
          setLang(next);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => dispatch(logout()) },
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
            <Text style={S.profileName}>{user?.fullName?.toUpperCase() || 'DRIVER'}</Text>
            <Text style={S.profilePhone}>{user?.phone}</Text>
            {driver?.status && (
              <View style={[S.statusPill, driver.status === 'ONLINE' && S.statusOnline]}>
                <Text style={S.statusPillText}>
                  {driver.status === 'ONLINE' ? '🟢 Online' : '⚫ Offline'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Nav app selector */}
        <TouchableOpacity
          style={S.navAppRow}
          onPress={() => Alert.alert('Navigation App', 'Coming soon — Google Maps, Waze, Apple Maps')}
        >
          <Text style={S.navAppIcon}>🧭</Text>
          <Text style={S.navAppText}>Select my default navigation app</Text>
          <Text style={S.chevron}>›</Text>
        </TouchableOpacity>
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
                <Text style={[S.menuLabel, { color: C.text }]}>{item.label}</Text>
                <Text style={[S.chevron, { color: C.gray }]}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Sign Out */}
        <TouchableOpacity style={[S.signOutBtn, { backgroundColor: C.white }]} onPress={handleLogout}>
          <Text style={S.menuIcon}>🚪</Text>
          <Text style={S.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={[S.version, { color: C.gray }]}>Fetno Driver v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  root: { flex: 1 },

  header: { backgroundColor: COLORS.primary, paddingBottom: 0 },
  profileRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  avatarWrap: { marginRight: 16, position: 'relative' },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditIcon: { fontSize: 11 },
  avatarFallback: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: COLORS.white, fontSize: 26, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { color: COLORS.white, fontSize: 22, fontWeight: '800', letterSpacing: 1 },
  profilePhone: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  statusPill: {
    alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
  },
  statusOnline: { backgroundColor: 'rgba(40,167,69,0.3)' },
  statusPillText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },

  navAppRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 16, marginBottom: 16,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
  },
  navAppIcon: { fontSize: 20, marginRight: 12 },
  navAppText: { flex: 1, color: COLORS.white, fontSize: 14, fontWeight: '600' },

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

  version: { textAlign: 'center', fontSize: 12, paddingBottom: 32, marginTop: 4 },
});
