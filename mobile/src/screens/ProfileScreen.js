import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useSelector, useDispatch } from 'react-redux';
import { loadUser, updateDriver } from '../store/authStore';
import { authAPI, uploadAPI } from '../services/api';
import { COLORS, VEHICLE_TYPES } from '../utils/constants';

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

export default function ProfileScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, driver } = useSelector((s) => s.auth);

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const initials = user?.fullName
    ? user.fullName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const vehicleLabel = VEHICLE_TYPES.find((v) => v.value === driver?.vehicleType)?.label
    || driver?.vehicleType || '—';
  const vehicleIcon = VEHICLE_ICONS[driver?.vehicleType] || '🚗';

  const statusColor = STATUS_COLORS[driver?.status] || '#6B7280';

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
    try {
      setUploadingPhoto(true);
      const { data } = await uploadAPI.avatar(result.assets[0].uri);
      dispatch(updateDriver({ profilePhotoUrl: data.data.avatarUrl }));
    } catch {
      Alert.alert('Upload failed', 'Could not update your profile photo. Try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Name is required'); return;
    }
    setSaving(true);
    try {
      await authAPI.updateProfile({ fullName: fullName.trim(), email: email.trim() || undefined });
      await dispatch(loadUser());
      setEditing(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={S.root}>
      {/* ── Green header ── */}
      <SafeAreaView style={S.header} edges={['top']}>
        <View style={S.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.backBtn}>
            <Text style={S.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={S.headerTitle}>My Account</Text>
          <TouchableOpacity
            onPress={() => {
              if (editing) {
                setFullName(user?.fullName || '');
                setEmail(user?.email || '');
                setEditing(false);
              } else {
                setEditing(true);
              }
            }}
            style={S.editBtn}
          >
            <Text style={S.editBtnText}>{editing ? 'Cancel' : 'Edit'}</Text>
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
          <View style={S.avatarEditBadge}>
            {uploadingPhoto
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Text style={S.avatarEditIcon}>📷</Text>
            }
          </View>
        </TouchableOpacity>

        {/* ── Driver status badge ── */}
        {driver?.status && (
          <View style={[S.statusBadge, { backgroundColor: statusColor + '33', borderColor: statusColor + '66' }]}>
            <View style={[S.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[S.statusText, { color: statusColor === '#6B7280' ? 'rgba(255,255,255,0.7)' : COLORS.white }]}>
              {driver.status}
            </Text>
          </View>
        )}
      </SafeAreaView>

      <ScrollView style={S.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* ── Stats strip ── */}
        {driver && (
          <View style={S.statsRow}>
            <View style={S.statCell}>
              <Text style={S.statVal}>{driver.totalDeliveries ?? 0}</Text>
              <Text style={S.statKey}>Trips</Text>
            </View>
            <View style={S.statLine} />
            <View style={S.statCell}>
              {driver.rating != null
                ? <Text style={S.statVal}>⭐ {driver.rating.toFixed(1)}</Text>
                : <Text style={S.statVal}>—</Text>
              }
              <Text style={S.statKey}>Rating</Text>
            </View>
            <View style={S.statLine} />
            <View style={S.statCell}>
              <Text style={S.statVal}>
                {(driver.deliveryStreak ?? 0) >= 3 ? `🔥 ${driver.deliveryStreak}` : driver.deliveryStreak ?? 0}
              </Text>
              <Text style={S.statKey}>Streak</Text>
            </View>
            <View style={S.statLine} />
            <View style={S.statCell}>
              <Text style={S.statVal}>ETB {driver.totalEarnings?.toFixed(0) ?? '0'}</Text>
              <Text style={S.statKey}>Earned</Text>
            </View>
          </View>
        )}

        {/* ── Personal info ── */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Personal Info</Text>
          <View style={S.card}>
            <InfoField
              icon="👤"
              label="Full Name"
              value={editing ? fullName : user?.fullName}
              editing={editing}
              onChangeText={setFullName}
            />
            <InfoField
              icon="📱"
              label="Phone"
              value={user?.phone}
              editing={false}
            />
            <InfoField
              icon="✉️"
              label="Email"
              value={editing ? email : (user?.email || '—')}
              editing={editing}
              onChangeText={setEmail}
              keyboardType="email-address"
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
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={S.saveBtnText}>Save Changes</Text>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* ── Vehicle info ── */}
        {driver && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Vehicle</Text>
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
              <VehicleRow label="Make / Model" value={`${driver.vehicleMake || ''} ${driver.vehicleModel || ''}`.trim() || '—'} />
              <VehicleRow label="Color" value={driver.vehicleColor || '—'} />
              <VehicleRow label="Year" value={driver.vehicleYear ? String(driver.vehicleYear) : '—'} />
              <VehicleRow label="License #" value={driver.licenseNumber || '—'} />
              <VehicleRow
                label="License Expiry"
                value={driver.licenseExpiry
                  ? new Date(driver.licenseExpiry).toLocaleDateString('en-ET', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—'}
                last
              />
            </View>
          </View>
        )}

        {/* ── City / location ── */}
        {driver?.city && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Zone</Text>
            <View style={S.card}>
              <VehicleRow label="City" value={driver.city} />
              {driver.homeAddress && <VehicleRow label="Home Address" value={driver.homeAddress} last />}
            </View>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

function InfoField({ icon, label, value, editing, onChangeText, keyboardType, last }) {
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
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <Text style={IF.value}>{value}</Text>
        )}
      </View>
    </View>
  );
}

function VehicleRow({ label, value, last }) {
  return (
    <View style={[VR.row, !last && VR.border]}>
      <Text style={VR.label}>{label}</Text>
      <Text style={VR.value} numberOfLines={1}>{value}</Text>
    </View>
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
});

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },

  // Header
  header: { backgroundColor: COLORS.primary },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  backIcon: { fontSize: 32, color: COLORS.white, lineHeight: 36 },
  headerTitle: { flex: 1, color: COLORS.white, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  editBtn: { width: 48, alignItems: 'flex-end' },
  editBtnText: { color: '#FCBF49', fontSize: 15, fontWeight: '700' },

  // Avatar
  avatarWrap: { alignSelf: 'center', marginTop: 12, marginBottom: 8, position: 'relative' },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarFallback: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: { color: COLORS.white, fontSize: 30, fontWeight: '800' },
  avatarEditBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditIcon: { fontSize: 12 },

  // Status badge
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center', marginBottom: 16,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },

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
    backgroundColor: COLORS.primary, borderRadius: 50,
    paddingVertical: 15, alignItems: 'center', marginTop: 12,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  saveBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '800' },

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
});
