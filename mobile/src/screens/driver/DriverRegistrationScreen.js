import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image, SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { driverAPI } from '../../services/api';
import api from '../../services/api';
import { useDispatch } from 'react-redux';
import { loadUser } from '../../store/authStore';
import { COLORS, ETHIOPIAN_CITIES, VEHICLE_TYPES } from '../../utils/constants';
import { t } from '../../utils/i18n';

const TOTAL_STEPS = 4;

const VEHICLE_ICONS = {
  MOTORCYCLE: '🏍️',
  BAJAJ: '🛺',
  CAR: '🚗',
  VAN: '🚐',
  TRUCK: '🚚',
};

export default function DriverRegistrationScreen({ navigation }) {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [city, setCity] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [licensePhoto, setLicensePhoto] = useState(null);
  const [idPhoto, setIdPhoto] = useState(null);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [uploadingId, setUploadingId] = useState(false);

  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (type === 'license') { setLicensePhoto(asset); uploadDocument(asset, 'license'); }
      else { setIdPhoto(asset); uploadDocument(asset, 'id_card'); }
    }
  };

  const takePicture = async (type) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (type === 'license') { setLicensePhoto(asset); uploadDocument(asset, 'license'); }
      else { setIdPhoto(asset); uploadDocument(asset, 'id_card'); }
    }
  };

  const uploadDocument = async (asset, docType) => {
    const setter = docType === 'license' ? setUploadingLicense : setUploadingId;
    setter(true);
    try {
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: `${docType}_${Date.now()}.jpg` });
      await api.post(`/upload/driver/document/${docType}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.message || 'Could not upload photo. Please try again.');
    } finally {
      setter(false);
    }
  };

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!city) { setError('Please select the city you will be driving in.'); return; }
    } else if (step === 2) {
      if (!vehicleType) { setError('Please select your vehicle type.'); return; }
      if (!vehiclePlate.trim()) { setError('Please enter your license plate number.'); return; }
      if (!vehicleModel.trim()) { setError('Please enter your vehicle model.'); return; }
      if (!vehicleColor.trim()) { setError('Please enter your vehicle color.'); return; }
      if (!vehicleYear || isNaN(vehicleYear)) { setError('Please enter a valid vehicle year.'); return; }
    } else if (step === 3) {
      if (!licenseNumber.trim()) { setError('Please enter your license number.'); return; }
      if (!licenseExpiry.trim()) { setError('Please enter your license expiry date.'); return; }
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');
    try {
      await driverAPI.register({
        city, vehicleType, vehiclePlate, vehicleModel, vehicleColor,
        vehicleYear: parseInt(vehicleYear),
        licenseNumber, licenseExpiry,
      });
      await api.get('/wallet').catch(() => {});
      dispatch(loadUser());
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      setIsLoading(false);
    }
  };

  const progressPct = `${(step / TOTAL_STEPS) * 100}%`;

  const STEP_META = [
    { icon: '📍', title: 'Select your city', subtitle: 'ሾፌር የሚሰሩበት ከተማ ይምረጡ' },
    { icon: '🚗', title: 'Vehicle details', subtitle: 'የተሽከርካሪ መረጃ ያስገቡ' },
    { icon: '🪪', title: 'License information', subtitle: 'የሾፌር ፍቃድ መረጃ ያስገቡ' },
    { icon: '📄', title: 'Upload documents', subtitle: 'ሰነዶችዎን ይስቀሉ — ኋላ ማስገባት ይቻላል' },
  ];

  const meta = STEP_META[step - 1];

  return (
    <SafeAreaView style={styles.safe}>
      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (step > 1 ? setStep((s) => s - 1) : navigation.goBack())}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.topMeta}>
          <Text style={styles.topTitle}>Driver Registration</Text>
          <Text style={styles.topSub}>Step {step} of {TOTAL_STEPS}</Text>
        </View>

        {/* Step dots */}
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i + 1 < step && styles.dotDone,
                i + 1 === step && styles.dotActive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: progressPct }]} />
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step header */}
        <View style={styles.stepHeader}>
          <View style={styles.stepIconWrap}>
            <Text style={styles.stepIcon}>{meta.icon}</Text>
          </View>
          <View style={styles.stepHeaderText}>
            <Text style={styles.stepTitle}>{meta.title}</Text>
            <Text style={styles.stepSubtitle}>{meta.subtitle}</Text>
          </View>
        </View>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorMsg}>{error}</Text>
          </View>
        )}

        {/* ─── Step 1: City ─── */}
        {step === 1 && (
          <View style={styles.cityGrid}>
            {ETHIOPIAN_CITIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.cityChip, city === c.value && styles.cityChipActive]}
                onPress={() => { setCity(c.value); setError(''); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.cityChipText, city === c.value && styles.cityChipTextActive]}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── Step 2: Vehicle ─── */}
        {step === 2 && (
          <>
            <Text style={styles.sectionLabel}>Vehicle type *</Text>
            <View style={styles.vehicleGrid}>
              {VEHICLE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v.value}
                  style={[styles.vehicleCard, vehicleType === v.value && styles.vehicleCardActive]}
                  onPress={() => { setVehicleType(v.value); setError(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.vehicleIcon}>{VEHICLE_ICONS[v.value]}</Text>
                  <Text style={[styles.vehicleLabel, vehicleType === v.value && styles.vehicleLabelActive]}>
                    {v.label.split(' ')[0]}
                  </Text>
                  {vehicleType === v.value && (
                    <View style={styles.vehicleCheck}>
                      <Text style={styles.vehicleCheckText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <FormField label="License plate *" value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="e.g. AA-12345" autoCapitalize="characters" />
            <FormField label="Vehicle model *" value={vehicleModel} onChangeText={setVehicleModel} placeholder="e.g. Honda CB150R" />
            <View style={styles.row}>
              <View style={styles.rowHalf}>
                <FormField label="Color *" value={vehicleColor} onChangeText={setVehicleColor} placeholder="e.g. Red" />
              </View>
              <View style={[styles.rowHalf, { marginLeft: 12 }]}>
                <FormField label="Year *" value={vehicleYear} onChangeText={setVehicleYear} placeholder="2020" keyboardType="number-pad" maxLength={4} />
              </View>
            </View>
          </>
        )}

        {/* ─── Step 3: License ─── */}
        {step === 3 && (
          <>
            <FormField label="License number *" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="e.g. ETH-001234" autoCapitalize="characters" />
            <FormField
              label="Expiry date *"
              value={licenseExpiry}
              onChangeText={setLicenseExpiry}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
            />
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                Make sure your license is valid for at least 3 months from today.
              </Text>
            </View>
          </>
        )}

        {/* ─── Step 4: Documents ─── */}
        {step === 4 && (
          <>
            <DocBox
              label="Driver's License"
              sublabel="የሾፌር ፍቃድ ፎቶ"
              photo={licensePhoto}
              isUploading={uploadingLicense}
              onPickPhoto={() => pickImage('license')}
              onTakePhoto={() => takePicture('license')}
            />
            <DocBox
              label="National ID / Passport"
              sublabel="የሀገር መታወቂያ ወይም ፓስፖርት"
              photo={idPhoto}
              isUploading={uploadingId}
              onPickPhoto={() => pickImage('id_card')}
              onTakePhoto={() => takePicture('id_card')}
            />
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                Documents are optional now — you can upload them later from your Profile. Uploading speeds up account approval.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Bottom CTA ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.ctaBtn, isLoading && styles.ctaBtnDisabled]}
          onPress={step < TOTAL_STEPS ? nextStep : handleSubmit}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={styles.ctaBtnText}>
              {step < TOTAL_STEPS ? 'Continue' : 'Submit Application'}
            </Text>
          )}
        </TouchableOpacity>
        {step === TOTAL_STEPS && (
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading} style={styles.skipLink}>
            <Text style={styles.skipText}>Skip documents for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ── Sub-components ── */

function FormField({ label, value, onChangeText, placeholder, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={fieldStyles.group}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, focused && fieldStyles.inputFocused]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

function DocBox({ label, sublabel, photo, isUploading, onPickPhoto, onTakePhoto }) {
  return (
    <View style={docStyles.wrap}>
      <View style={docStyles.header}>
        <View>
          <Text style={docStyles.label}>{label}</Text>
          <Text style={docStyles.sublabel}>{sublabel}</Text>
        </View>
        {photo && !isUploading && (
          <View style={docStyles.uploadedBadge}>
            <Text style={docStyles.uploadedText}>✓ Uploaded</Text>
          </View>
        )}
      </View>

      {photo ? (
        <View style={docStyles.preview}>
          <Image source={{ uri: photo.uri }} style={docStyles.previewImg} resizeMode="cover" />
          {isUploading && (
            <View style={docStyles.uploadOverlay}>
              <ActivityIndicator color={COLORS.white} />
              <Text style={docStyles.uploadOverlayText}>Uploading…</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={docStyles.btnRow}>
          <TouchableOpacity style={docStyles.btn} onPress={onTakePhoto} activeOpacity={0.8}>
            <Text style={docStyles.btnIcon}>📷</Text>
            <Text style={docStyles.btnText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={docStyles.btn} onPress={onPickPhoto} activeOpacity={0.8}>
            <Text style={docStyles.btnIcon}>🖼️</Text>
            <Text style={docStyles.btnText}>From Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ── Styles ── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  backIcon: { fontSize: 20, color: COLORS.text, lineHeight: 24 },
  topMeta: { flex: 1 },
  topTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  topSub: { fontSize: 12, color: COLORS.gray, marginTop: 1 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.grayLight },
  dotDone: { backgroundColor: COLORS.primaryLighter },
  dotActive: { backgroundColor: COLORS.primary, width: 20, borderRadius: 4 },

  progressBg: { height: 3, backgroundColor: COLORS.grayLight },
  progressFill: { height: 3, backgroundColor: COLORS.primary },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },

  stepHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 24, gap: 14,
  },
  stepIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
  },
  stepIcon: { fontSize: 24 },
  stepHeaderText: { flex: 1 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: COLORS.black },
  stepSubtitle: { fontSize: 13, color: COLORS.gray, marginTop: 2 },

  errorBanner: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errorMsg: { color: '#991B1B', fontSize: 13 },

  /* City */
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cityChip: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FAFAFA',
  },
  cityChipActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  cityChipText: { fontSize: 13, color: COLORS.gray, fontWeight: '500' },
  cityChipTextActive: { color: COLORS.primary, fontWeight: '700' },

  /* Vehicle */
  sectionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  vehicleCard: {
    width: '30%', borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    backgroundColor: '#FAFAFA', position: 'relative',
  },
  vehicleCardActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  vehicleIcon: { fontSize: 26, marginBottom: 6 },
  vehicleLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600', textAlign: 'center' },
  vehicleLabelActive: { color: COLORS.primary },
  vehicleCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleCheckText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },

  row: { flexDirection: 'row' },
  rowHalf: { flex: 1 },

  hintBox: {
    backgroundColor: '#FFFBEB', borderRadius: 12,
    padding: 14, marginTop: 8,
    borderLeftWidth: 3, borderLeftColor: '#FCBF49',
  },
  hintText: { color: '#92400E', fontSize: 13, lineHeight: 20 },

  /* Bottom bar */
  bottomBar: {
    padding: 20, paddingBottom: 28,
    backgroundColor: COLORS.white,
    borderTopWidth: 1, borderTopColor: COLORS.grayLight,
  },
  ctaBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 5,
  },
  ctaBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  ctaBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  skipLink: { alignItems: 'center', marginTop: 14 },
  skipText: { fontSize: 13, color: COLORS.gray },
});

const fieldStyles = StyleSheet.create({
  group: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, backgroundColor: '#FAFAFA', color: COLORS.text,
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
});

const docStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 16, padding: 16, marginBottom: 16,
    backgroundColor: '#FAFAFA',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  label: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  sublabel: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  uploadedBadge: {
    backgroundColor: '#E8F5E9', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  uploadedText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 12, borderStyle: 'dashed',
    paddingVertical: 18, alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  btnIcon: { fontSize: 26, marginBottom: 6 },
  btnText: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
  preview: { borderRadius: 12, overflow: 'hidden' },
  previewImg: { width: '100%', height: 160 },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center', borderRadius: 12,
  },
  uploadOverlayText: { color: COLORS.white, marginTop: 8, fontSize: 13, fontWeight: '600' },
});
