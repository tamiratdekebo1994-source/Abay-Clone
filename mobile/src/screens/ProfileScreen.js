import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useSelector, useDispatch } from 'react-redux';
import Constants from 'expo-constants';
import { loadUser, updateDriver, logout, refreshDriverStats } from '../store/authStore';
import { authAPI, driverAPI, uploadAPI } from '../services/api';
import { COLORS, VEHICLE_TYPES } from '../utils/constants';
import { t } from '../utils/i18n';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const VEHICLE_ICONS = {
  MOTORCYCLE: '🏍️',
  BAJAJ:      '🛺',
  CAR:        '🚗',
  VAN:        '🚐',
  TRUCK:      '🚛',
};

const STATUS_COLORS = {
  APPROVED:  '#16A34A',
  ONLINE:    '#16A34A',
  PENDING:   '#D97706',
  SUSPENDED: '#DC2626',
  OFFLINE:   '#6B7280',
};

const DRIVER_STATUS_KEYS = {
  ONLINE: 'online', OFFLINE: 'offline', PENDING: 'pending',
  APPROVED: 'statusApproved', SUSPENDED: 'statusSuspended', REJECTED: 'statusRejected',
};

const STATUS_INFO_KEYS = {
  PENDING: {
    icon: '⏳',
    titleKey: 'accountUnderReviewTitle',
    bodyKey: 'accountUnderReviewBody',
    bg: '#FFFBEB', border: '#FDE68A', text: '#92400E',
  },
  SUSPENDED: {
    icon: '🚫',
    titleKey: 'accountSuspendedTitle',
    bodyKey: 'accountSuspendedBody',
    bg: '#FEF2F2', border: '#FECACA', text: '#991B1B',
  },
};

function driverFormFrom(driver) {
  return {
    dateOfBirth: driver?.dateOfBirth || '',
    nationalId: driver?.nationalId || '',
    emergencyContactName: driver?.emergencyContactName || '',
    emergencyContactPhone: driver?.emergencyContactPhone || '',
    homeAddress: driver?.homeAddress || '',
    vehicleMake: driver?.vehicleMake || '',
    vehicleModel: driver?.vehicleModel || '',
    vehicleYear: driver?.vehicleYear ? String(driver.vehicleYear) : '',
    vehicleColor: driver?.vehicleColor || '',
    vehiclePlate: driver?.vehiclePlate || '',
    licenseNumber: driver?.licenseNumber || '',
    licenseClass: driver?.licenseClass || '',
    licenseExpiry: driver?.licenseExpiry || '',
  };
}

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, driver } = useSelector((s) => s.auth);
  const language = useSelector((s) => s.settings.language);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [form, setForm] = useState(() => driverFormFrom(driver));
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      dispatch(refreshDriverStats());
    }, [dispatch])
  );

  const initials = user?.fullName
    ? user.fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const vehicleLabel = VEHICLE_TYPES.find((v) => v.value === driver?.vehicleType)?.label
    || driver?.vehicleType || '—';
  const vehicleIcon = VEHICLE_ICONS[driver?.vehicleType] || '🚗';
  const statusColor = STATUS_COLORS[driver?.status] || '#6B7280';
  const statusInfoConfig = STATUS_INFO_KEYS[driver?.status] ?? null;
  const driverStatusLabel = driver?.status
    ? (DRIVER_STATUS_KEYS[driver.status] ? t(DRIVER_STATUS_KEYS[driver.status], language) : driver.status)
    : null;
  const genderLabel = driver?.gender === 'MALE' ? t('genderMale', language)
    : driver?.gender === 'FEMALE' ? t('genderFemale', language)
    : '—';

  // Syncs local edit fields to the latest server values — used both when entering
  // edit mode (so a background refreshDriverStats() isn't overwritten by stale
  // local state) and when cancelling (to discard unsaved edits).
  const startOrCancelEditing = () => {
    setFullName(user?.fullName || '');
    setEmail(user?.email || '');
    setForm(driverFormFrom(driver));
    setEditing((e) => !e);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('permissionNeededTitle', language), t('allowPhotoAccessBody', language));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      setUploadingPhoto(true);
      const { data } = await uploadAPI.avatar(result.assets[0].uri);
      dispatch(updateDriver({ profilePhotoUrl: data.data?.avatarUrl ?? data.data?.url }));
    } catch {
      Alert.alert(t('uploadFailedTitle', language), t('profilePhotoFailedBody', language));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert(t('nameRequired', language)); return;
    }
    if (form.licenseExpiry.trim() && isNaN(new Date(form.licenseExpiry.trim()).getTime())) {
      Alert.alert(t('invalidTitle', language), t('enterExpiryFormatBody', language)); return;
    }
    setSaving(true);
    try {
      await Promise.all([
        authAPI.updateProfile({ fullName: fullName.trim(), email: email.trim() || undefined }),
        driverAPI.updateProfile({
          dateOfBirth: form.dateOfBirth.trim() || undefined,
          nationalId: form.nationalId.trim() || undefined,
          emergencyContactName: form.emergencyContactName.trim() || undefined,
          emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
          homeAddress: form.homeAddress.trim() || undefined,
          vehicleMake: form.vehicleMake.trim() || undefined,
          vehicleModel: form.vehicleModel.trim() || undefined,
          vehicleYear: form.vehicleYear.trim() ? parseInt(form.vehicleYear.trim(), 10) : undefined,
          vehicleColor: form.vehicleColor.trim() || undefined,
          vehiclePlate: form.vehiclePlate.trim() || undefined,
          licenseNumber: form.licenseNumber.trim() || undefined,
          licenseClass: form.licenseClass.trim() || undefined,
          licenseExpiry: form.licenseExpiry.trim() || undefined,
        }),
      ]);
      await dispatch(loadUser());
      setEditing(false);
    } catch (err) {
      Alert.alert(t('errorTitle', language), err.response?.data?.message || t('saveFailedBody', language));
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      t('signOut', language),
      t('signOutConfirm', language),
      [
        { text: t('cancel', language), style: 'cancel' },
        {
          text: t('signOut', language),
          style: 'destructive',
          onPress: () => dispatch(logout()),
        },
      ]
    );
  };

  return (
    <View style={S.root}>
      {/* ── Green header ── */}
      <SafeAreaView style={S.header} edges={['top']}>
        <View style={S.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
            <Text style={S.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={S.headerTitle}>{t('myAccount', language)}</Text>
          <TouchableOpacity onPress={startOrCancelEditing} style={S.editBtn}>
            <Text style={S.editBtnText}>{editing ? t('cancel', language) : t('edit', language)}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Avatar ── */}
        <TouchableOpacity style={S.avatarWrap} onPress={pickPhoto} activeOpacity={0.8}>
          {driver?.profilePhotoUrl ? (
            <Image source={{ uri: driver.profilePhotoUrl }} style={S.avatar} />
          ) : (
            <View style={S.avatarFallback}>
              <Text style={S.avatarInitials}>{initials}</Text>
            </View>
          )}
          {driver?.status && !statusInfoConfig && (
            <View style={[S.statusDotIndicator, { backgroundColor: statusColor }]} />
          )}
          <View style={S.avatarEditBadge}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Text style={S.avatarEditIcon}>📷</Text>
            }
          </View>
        </TouchableOpacity>

        {/* ── Driver status badge (only when it needs explaining — Pending/Suspended) ── */}
        {driver?.status && statusInfoConfig && (
          <View style={[S.statusBadge, { backgroundColor: statusColor + '33', borderColor: statusColor + '66' }]}>
            <View style={[S.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[S.statusText, { color: COLORS.primary }]}>
              {driverStatusLabel}
            </Text>
          </View>
        )}
      </SafeAreaView>

      <ScrollView style={S.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Status alert for PENDING / SUSPENDED ── */}
        {statusInfoConfig && (
          <View style={[S.statusAlert, { backgroundColor: statusInfoConfig.bg, borderColor: statusInfoConfig.border }]}>
            <Text style={S.statusAlertIcon}>{statusInfoConfig.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.statusAlertTitle, { color: statusInfoConfig.text }]}>{t(statusInfoConfig.titleKey, language)}</Text>
              <Text style={[S.statusAlertBody, { color: statusInfoConfig.text }]}>{t(statusInfoConfig.bodyKey, language)}</Text>
            </View>
          </View>
        )}

        {/* ── Stats strip ── */}
        {driver && (
          <View style={S.statsRow}>
            <View style={S.statCell}>
              <Text style={S.statVal}>{driver.totalDeliveries ?? 0}</Text>
              <Text style={S.statKey}>{t('trips', language)}</Text>
            </View>
            <View style={S.statLine} />
            <View style={S.statCell}>
              {driver.rating != null
                ? <Text style={S.statVal}>⭐ {driver.rating.toFixed(1)}</Text>
                : <Text style={S.statVal}>—</Text>
              }
              <Text style={S.statKey}>{t('rating', language)}</Text>
            </View>
            <View style={S.statLine} />
            <View style={S.statCell}>
              <Text style={S.statVal}>
                {(driver.deliveryStreak ?? 0) >= 3 ? `🔥 ${driver.deliveryStreak}` : driver.deliveryStreak ?? 0}
              </Text>
              <Text style={S.statKey}>{t('streak', language)}</Text>
            </View>
            <View style={S.statLine} />
            <View style={S.statCell}>
              <Text style={S.statVal}>ETB {driver.totalEarnings?.toFixed(0) ?? '0'}</Text>
              <Text style={S.statKey}>{t('earned', language)}</Text>
            </View>
          </View>
        )}

        {/* ── Personal info ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{t('personalInfo', language)}</Text>
          <View style={S.card}>
            <InfoField
              icon="👤"
              label={t('fullName', language)}
              value={editing ? fullName : user?.fullName}
              editing={editing}
              onChangeText={setFullName}
            />
            <InfoField
              icon="📱"
              label={t('phone', language)}
              value={user?.phone}
              editing={false}
            />
            <InfoField
              icon="✉️"
              label={t('emailLabel', language)}
              value={editing ? email : (user?.email || '—')}
              editing={editing}
              onChangeText={setEmail}
              keyboardType="email-address"
            />
            <InfoField
              icon="🎂"
              label={t('dateOfBirth', language)}
              value={editing ? form.dateOfBirth : (driver?.dateOfBirth || '—')}
              editing={editing}
              onChangeText={(v) => setForm((p) => ({ ...p, dateOfBirth: v }))}
              placeholder="YYYY-MM-DD"
            />
            <InfoField
              icon="⚧"
              label={t('gender', language)}
              value={genderLabel}
              editing={false}
            />
            <InfoField
              icon="🪪"
              label={t('nationalIdNumber', language)}
              value={editing ? form.nationalId : (driver?.nationalId || '—')}
              editing={editing}
              onChangeText={(v) => setForm((p) => ({ ...p, nationalId: v }))}
              last
            />
          </View>

          {editing && (
            <TouchableOpacity
              style={[S.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color={COLORS.primary} />
                : <Text style={S.saveBtnText}>{t('saveChanges', language)}</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* ── Emergency contact ── */}
        {driver && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>{t('emergencyContact', language)}</Text>
            <View style={S.card}>
              <InfoField
                icon="👤"
                label={t('contactName', language)}
                value={editing ? form.emergencyContactName : (driver.emergencyContactName || '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, emergencyContactName: v }))}
              />
              <InfoField
                icon="📞"
                label={t('contactPhone', language)}
                value={editing ? form.emergencyContactPhone : (driver.emergencyContactPhone || '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, emergencyContactPhone: v }))}
                keyboardType="phone-pad"
                last
              />
            </View>
          </View>
        )}

        {/* ── Vehicle info ── */}
        {driver && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>{t('vehicle', language)}</Text>
            <View style={S.vehicleCard}>
              <View style={S.vehicleIconBox}>
                <Text style={S.vehicleIconText}>{vehicleIcon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.vehicleType}>{vehicleLabel}</Text>
                <Text style={S.vehiclePlate}>{driver.vehiclePlate}</Text>
              </View>
            </View>

            <View style={S.card}>
              <VehicleRow
                label={t('vehicleMakeLabel', language)}
                value={editing ? form.vehicleMake : (driver.vehicleMake || '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, vehicleMake: v }))}
              />
              <VehicleRow
                label={t('modelLabel', language)}
                value={editing ? form.vehicleModel : (driver.vehicleModel || '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, vehicleModel: v }))}
              />
              <VehicleRow
                label={t('vehicleColor', language)}
                value={editing ? form.vehicleColor : (driver.vehicleColor || '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, vehicleColor: v }))}
              />
              <VehicleRow
                label={t('vehicleYear', language)}
                value={editing ? form.vehicleYear : (driver.vehicleYear ? String(driver.vehicleYear) : '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, vehicleYear: v }))}
                keyboardType="numeric"
              />
              <VehicleRow
                label={t('plateNumberRequired', language)}
                value={editing ? form.vehiclePlate : (driver.vehiclePlate || '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, vehiclePlate: v.toUpperCase() }))}
              />
              <VehicleRow
                label={t('licenseNumberShort', language)}
                value={editing ? form.licenseNumber : (driver.licenseNumber || '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, licenseNumber: v }))}
              />
              <VehicleRow
                label={t('licenseClassLabel', language)}
                value={editing ? form.licenseClass : (driver.licenseClass || '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, licenseClass: v }))}
              />
              <VehicleRow
                label={t('licenseExpiry', language)}
                value={editing ? form.licenseExpiry : (driver.licenseExpiry
                  ? new Date(driver.licenseExpiry).toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, licenseExpiry: v }))}
                placeholder="YYYY-MM-DD"
                last
              />
            </View>
          </View>
        )}

        {/* ── City / location ── */}
        {driver?.city && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>{t('zone', language)}</Text>
            <View style={S.card}>
              <VehicleRow label={t('city', language)} value={driver.city} />
              <VehicleRow
                label={t('homeAddress', language)}
                value={editing ? form.homeAddress : (driver.homeAddress || '—')}
                editing={editing}
                onChangeText={(v) => setForm((p) => ({ ...p, homeAddress: v }))}
                last
              />
            </View>
          </View>
        )}

        {/* ── Support ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>{t('support', language)}</Text>
          <View style={S.card}>
            <LinkRow
              icon="📞"
              label={t('callSupport', language)}
              detail="+251 911 000 000"
              onPress={() => Linking.openURL('tel:+251911000000')}
            />
            <LinkRow
              icon="✉️"
              label={t('emailSupport', language)}
              detail="support@etspark.et"
              onPress={() => Linking.openURL('mailto:support@etspark.et')}
              last
            />
          </View>
        </View>

        {/* ── Sign Out ── */}
        <View style={S.section}>
          <TouchableOpacity style={S.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
            <Text style={S.signOutText}>{t('signOut', language)}</Text>
          </TouchableOpacity>
        </View>

        {/* ── App version ── */}
        <Text style={S.version}>ET Spark v{APP_VERSION}</Text>

      </ScrollView>
    </View>
  );
}

function InfoField({ icon, label, value, editing, onChangeText, keyboardType, placeholder, last }) {
  return (
    <View style={[IF.row, !last && IF.border]}>
      <Text style={IF.icon}>{icon}</Text>
      <View style={IF.body}>
        <Text style={IF.label}>{label}</Text>
        {editing && onChangeText ? (
          <TextInput
            style={IF.input}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType || 'default'}
            autoCapitalize="words"
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <Text style={IF.value}>{value}</Text>
        )}
      </View>
    </View>
  );
}

function VehicleRow({ label, value, editing, onChangeText, keyboardType, placeholder, last }) {
  return (
    <View style={[VR.row, !last && VR.border]}>
      <Text style={VR.label}>{label}</Text>
      {editing && onChangeText ? (
        <TextInput
          style={VR.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType || 'default'}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
        />
      ) : (
        <Text style={VR.value} numberOfLines={1}>{value}</Text>
      )}
    </View>
  );
}

function LinkRow({ icon, label, detail, onPress, last }) {
  return (
    <TouchableOpacity style={[LR.row, !last && LR.border]} onPress={onPress} activeOpacity={0.7}>
      <Text style={LR.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={LR.label}>{label}</Text>
        <Text style={LR.detail}>{detail}</Text>
      </View>
      <Text style={LR.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const IF = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 13 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  icon: { fontSize: 18, width: 26, marginTop: 1 },
  body: { flex: 1 },
  label: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  value: { fontSize: 15, color: '#111827', fontWeight: '500', marginTop: 2 },
  input: {
    fontSize: 15, color: '#111827', fontWeight: '500', marginTop: 2,
    borderBottomWidth: 1.5, borderBottomColor: COLORS.primary, paddingBottom: 2,
  },
});

const VR = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  label: { flex: 1, fontSize: 14, color: '#6B7280', fontWeight: '500' },
  value: { fontSize: 14, color: '#111827', fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
  input: {
    flex: 1, fontSize: 14, color: '#111827', fontWeight: '600', textAlign: 'right',
    borderBottomWidth: 1.5, borderBottomColor: COLORS.primary, paddingBottom: 2,
  },
});

const LR = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  icon: { fontSize: 18, width: 26 },
  label: { fontSize: 15, color: '#111827', fontWeight: '600' },
  detail: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  chevron: { fontSize: 22, color: '#D1D5DB', lineHeight: 26 },
});

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },

  // Header
  header: { backgroundColor: COLORS.accent },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backIcon: { fontSize: 32, color: COLORS.primary, lineHeight: 36 },
  headerTitle: { flex: 1, color: COLORS.primary, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  editBtn: { width: 48, alignItems: 'flex-end' },
  editBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },

  // Avatar
  avatarWrap: { alignSelf: 'center', marginTop: 10, marginBottom: 14, position: 'relative' },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2.5, borderColor: 'rgba(27,67,50,0.4)',
  },
  avatarFallback: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(27,67,50,0.15)',
    borderWidth: 2.5, borderColor: 'rgba(27,67,50,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: COLORS.primary, fontSize: 24, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditIcon: { fontSize: 10 },
  statusDotIndicator: {
    position: 'absolute', bottom: 1, left: 1,
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.accent,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', marginBottom: 16,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

  // Status alert banner
  statusAlert: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 16, marginTop: 16,
    borderWidth: 1, borderRadius: 14, padding: 14,
  },
  statusAlertIcon: { fontSize: 22, lineHeight: 26 },
  statusAlertTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
  statusAlertBody: { fontSize: 13, lineHeight: 19 },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 14, paddingVertical: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 2,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  statKey: { fontSize: 10, color: '#9CA3AF', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  statLine: { width: 1, backgroundColor: '#F3F4F6' },

  // Sections
  scroll: { flex: 1 },
  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#9CA3AF',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8, marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },

  // Save button
  saveBtn: {
    backgroundColor: COLORS.accent, borderRadius: 50,
    paddingVertical: 15, alignItems: 'center', marginTop: 12,
    shadowColor: COLORS.accentDark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  saveBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '800' },

  // Vehicle card
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  vehicleIconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center',
  },
  vehicleIconText: { fontSize: 26 },
  vehicleType: { fontSize: 15, fontWeight: '700', color: '#111827' },
  vehiclePlate: {
    fontSize: 13, fontWeight: '700', color: COLORS.primary,
    marginTop: 3, letterSpacing: 1,
  },

  // Sign out
  signOutBtn: {
    borderRadius: 50, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: '#FFF5F5',
  },
  signOutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },

  // Version
  version: {
    textAlign: 'center', fontSize: 12, color: '#9CA3AF',
    marginTop: 24, marginBottom: 8,
  },
});
