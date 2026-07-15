import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch } from 'react-redux';
import { loadUser } from '../../store/authStore';
import { driverAPI } from '../../services/api';
import { COLORS } from '../../utils/constants';

const TOTAL_STEPS = 5;

const ETHIOPIAN_CITIES = [
  'Addis Ababa', 'Dire Dawa', 'Mekelle', 'Gondar', 'Bahir Dar',
  'Hawassa', 'Adama', 'Jimma', 'Dessie', 'Jijiga',
  'Shashamane', 'Bishoftu', 'Arba Minch', 'Hosaena', 'Harar',
];

const VEHICLE_TYPES = [
  { key: 'MOTORCYCLE', label: 'Motorcycle', icon: '🏍️' },
  { key: 'BAJAJ', label: 'Bajaj', icon: '🛺' },
  { key: 'CAR', label: 'Car', icon: '🚗' },
  { key: 'VAN', label: 'Van', icon: '🚐' },
  { key: 'TRUCK', label: 'Truck', icon: '🚚' },
];

const VEHICLE_MAKES = {
  MOTORCYCLE: ['Bajaj', 'Honda', 'Yamaha', 'TVS', 'Hero', 'Lifan', 'Other'],
  BAJAJ: ['Bajaj', 'Piaggio', 'TVS', 'Other'],
  CAR: ['Toyota', 'Hyundai', 'Nissan', 'Suzuki', 'Kia', 'Ford', 'Volkswagen', 'Other'],
  VAN: ['Toyota', 'Hyundai', 'Nissan', 'Mitsubishi', 'Ford', 'Other'],
  TRUCK: ['Isuzu', 'Mitsubishi', 'Toyota', 'Hyundai', 'Tata', 'Other'],
};

const LICENSE_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F'];

const GENDERS = [
  { key: 'MALE', label: 'Male' },
  { key: 'FEMALE', label: 'Female' },
];

const STEP_META = [
  { icon: '👤', title: 'Personal Info', titleAm: 'የግል መረጃ' },
  { icon: '📍', title: 'Location', titleAm: 'መኖሪያ ቦታ' },
  { icon: '🚗', title: 'Vehicle', titleAm: 'ተሽከርካሪ' },
  { icon: '📋', title: 'License', titleAm: 'ፍቃድ' },
  { icon: '📸', title: 'Documents', titleAm: 'ሰነዶች' },
];

function FieldLabel({ label }) {
  return <Text style={S.label}>{label}</Text>;
}

function StyledInput({ value, onChangeText, placeholder, keyboardType, maxLength, multiline }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[S.input, focused && S.inputFocused, multiline && S.inputMulti]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.gray}
      keyboardType={keyboardType || 'default'}
      maxLength={maxLength}
      multiline={multiline}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function ChipRow({ options, selected, onSelect, keyField = 'key', labelField = 'label' }) {
  return (
    <View style={S.chipRow}>
      {options.map((opt) => {
        const k = typeof opt === 'string' ? opt : opt[keyField];
        const l = typeof opt === 'string' ? opt : opt[labelField];
        const active = selected === k;
        return (
          <TouchableOpacity
            key={k}
            style={[S.chip, active && S.chipActive]}
            onPress={() => onSelect(k)}
            activeOpacity={0.75}
          >
            <Text style={[S.chipText, active && S.chipTextActive]}>{l}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PhotoBlock({ label, uri, onPick }) {
  return (
    <View style={S.photoBlock}>
      <TouchableOpacity style={[S.photoBox, uri && S.photoBoxFilled]} onPress={onPick} activeOpacity={0.8}>
        {uri ? (
          <Text style={S.photoCheck}>✓ Uploaded</Text>
        ) : (
          <>
            <Text style={S.photoPlus}>+</Text>
            <Text style={S.photoHint}>Tap to upload</Text>
          </>
        )}
      </TouchableOpacity>
      <Text style={S.photoLabel}>{label}</Text>
    </View>
  );
}

export default function DriverRegistrationScreen({ navigation }) {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Step 2: Location
  const [city, setCity] = useState('');
  const [homeAddress, setHomeAddress] = useState('');

  // Step 3: Vehicle
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  // Step 4: License
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseClass, setLicenseClass] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');

  // Step 5: Documents
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [licensePhoto, setLicensePhoto] = useState(null);
  const [nationalIdPhoto, setNationalIdPhoto] = useState(null);
  const [vehiclePhoto, setVehiclePhoto] = useState(null);

  const pickImage = async (setter) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to upload documents.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      setter(result.assets[0].uri);
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!fullName.trim()) { Alert.alert('Required', 'Full name is required.'); return false; }
      if (!emergencyContactPhone.trim()) { Alert.alert('Required', 'Emergency contact phone is required.'); return false; }
      return true;
    }
    if (step === 2) {
      if (!city) { Alert.alert('Required', 'Please select your city.'); return false; }
      return true;
    }
    if (step === 3) {
      if (!vehicleType) { Alert.alert('Required', 'Please select vehicle type.'); return false; }
      if (!vehiclePlate.trim()) { Alert.alert('Required', 'Vehicle plate number is required.'); return false; }
      return true;
    }
    if (step === 4) {
      if (!licenseNumber.trim()) { Alert.alert('Required', 'License number is required.'); return false; }
      if (!licenseExpiry.trim()) { Alert.alert('Required', 'License expiry date is required.'); return false; }
      const expiryDate = new Date(licenseExpiry);
      if (isNaN(expiryDate.getTime())) { Alert.alert('Invalid', 'Enter expiry as YYYY-MM-DD.'); return false; }
      if (expiryDate < new Date()) { Alert.alert('Invalid', 'License has already expired.'); return false; }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);
    try {
      await driverAPI.register({
        fullName: fullName.trim(),
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        nationalId: nationalId.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim(),
        city,
        homeAddress: homeAddress.trim() || undefined,
        vehicleType,
        vehicleMake: vehicleMake || undefined,
        vehicleModel: vehicleModel.trim() || undefined,
        vehicleYear: vehicleYear ? parseInt(vehicleYear, 10) : undefined,
        vehicleColor: vehicleColor.trim() || undefined,
        vehiclePlate: vehiclePlate.trim().toUpperCase(),
        licenseNumber: licenseNumber.trim(),
        licenseClass: licenseClass || undefined,
        licenseExpiry,
      });
      await dispatch(loadUser());
      Alert.alert(
        '✓ Application Submitted',
        'Your driver application has been submitted successfully.\n\nOur team will review your information within 24-48 hours. You will receive a notification once your status is updated.\n\nThank you for choosing ET Spark!',
        [{ text: 'Got it', onPress: () => {} }]
      );
    } catch (err) {
      const msg = err?.response?.data?.message || 'Registration failed. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const meta = STEP_META[step - 1];
  const progress = step / TOTAL_STEPS;

  return (
    <SafeAreaView style={S.safe} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={S.header}>
        <TouchableOpacity style={S.backBtn} onPress={handleBack} disabled={step === 1}>
          <Text style={[S.backArrow, step === 1 && { opacity: 0 }]}>←</Text>
        </TouchableOpacity>
        <View style={S.headerCenter}>
          <Text style={S.headerBrand}>Fetno Driver</Text>
          <Text style={S.headerSub}>Step {step} of {TOTAL_STEPS}</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      {/* ── Progress ── */}
      <View style={S.progressTrack}>
        <View style={[S.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <View style={S.dotRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[S.dot, i < step && S.dotDone]} />
        ))}
      </View>

      <ScrollView
        style={S.scroll}
        contentContainerStyle={S.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step header ── */}
        <View style={S.stepHeader}>
          <View style={S.stepIconBox}>
            <Text style={S.stepIcon}>{meta.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.stepTitle}>{meta.title}</Text>
            <Text style={S.stepTitleAm}>{meta.titleAm}</Text>
          </View>
        </View>

        {/* ── STEP 1: Personal Info ── */}
        {step === 1 && (
          <View>
            <FieldLabel label="Full Name *" />
            <StyledInput value={fullName} onChangeText={setFullName} placeholder="As on your ID" />

            <FieldLabel label="Date of Birth" />
            <StyledInput value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" />

            <FieldLabel label="Gender" />
            <ChipRow options={GENDERS} selected={gender} onSelect={setGender} />

            <FieldLabel label="National ID Number" />
            <StyledInput value={nationalId} onChangeText={setNationalId} placeholder="National ID / Fayda" maxLength={50} />

            <View style={S.sectionDivider}>
              <Text style={S.sectionLabel}>Emergency Contact</Text>
            </View>

            <FieldLabel label="Contact Name" />
            <StyledInput value={emergencyContactName} onChangeText={setEmergencyContactName} placeholder="Full name" maxLength={100} />

            <FieldLabel label="Contact Phone *" />
            <StyledInput value={emergencyContactPhone} onChangeText={setEmergencyContactPhone} placeholder="+251 9XX XXX XXX" keyboardType="phone-pad" maxLength={20} />
          </View>
        )}

        {/* ── STEP 2: Location ── */}
        {step === 2 && (
          <View>
            <FieldLabel label="City *" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.cityScroll}>
              {ETHIOPIAN_CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[S.cityChip, city === c && S.cityChipActive]}
                  onPress={() => setCity(c)}
                  activeOpacity={0.75}
                >
                  <Text style={[S.cityChipText, city === c && S.cityChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {city ? <Text style={S.selectedCity}>📍 {city}</Text> : null}

            <FieldLabel label="Home Address" />
            <StyledInput
              value={homeAddress}
              onChangeText={setHomeAddress}
              placeholder="Subcity, Woreda, Street..."
              multiline
            />
          </View>
        )}

        {/* ── STEP 3: Vehicle ── */}
        {step === 3 && (
          <View>
            <FieldLabel label="Vehicle Type *" />
            <View style={S.vehicleGrid}>
              {VEHICLE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v.key}
                  style={[S.vehicleCard, vehicleType === v.key && S.vehicleCardActive]}
                  onPress={() => { setVehicleType(v.key); setVehicleMake(''); }}
                  activeOpacity={0.8}
                >
                  <Text style={S.vehicleIcon}>{v.icon}</Text>
                  <Text style={[S.vehicleLabel, vehicleType === v.key && S.vehicleLabelActive]}>{v.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {vehicleType ? (
              <>
                <FieldLabel label="Vehicle Make" />
                <ChipRow
                  options={VEHICLE_MAKES[vehicleType] || []}
                  selected={vehicleMake}
                  onSelect={setVehicleMake}
                  keyField={undefined}
                  labelField={undefined}
                />

                <FieldLabel label="Model" />
                <StyledInput value={vehicleModel} onChangeText={setVehicleModel} placeholder="e.g. Corolla, HB20..." maxLength={100} />

                <View style={S.twoCol}>
                  <View style={S.colHalf}>
                    <FieldLabel label="Year" />
                    <StyledInput value={vehicleYear} onChangeText={setVehicleYear} placeholder="2020" keyboardType="numeric" maxLength={4} />
                  </View>
                  <View style={S.colHalf}>
                    <FieldLabel label="Color" />
                    <StyledInput value={vehicleColor} onChangeText={setVehicleColor} placeholder="White" maxLength={50} />
                  </View>
                </View>

                <FieldLabel label="Plate Number *" />
                <StyledInput value={vehiclePlate} onChangeText={(t) => setVehiclePlate(t.toUpperCase())} placeholder="AA 12345" maxLength={20} />
              </>
            ) : null}
          </View>
        )}

        {/* ── STEP 4: License ── */}
        {step === 4 && (
          <View>
            <FieldLabel label="License Number *" />
            <StyledInput value={licenseNumber} onChangeText={setLicenseNumber} placeholder="ETH-DL-XXXXXXXXX" maxLength={50} />

            <FieldLabel label="License Class" />
            <ChipRow options={LICENSE_CLASSES} selected={licenseClass} onSelect={setLicenseClass} />

            <FieldLabel label="Expiry Date *" />
            <StyledInput value={licenseExpiry} onChangeText={setLicenseExpiry} placeholder="YYYY-MM-DD" />

            <View style={S.infoCard}>
              <Text style={S.infoIcon}>ℹ️</Text>
              <Text style={S.infoText}>Your license must be valid. Expired licenses will be rejected.</Text>
            </View>
          </View>
        )}

        {/* ── STEP 5: Documents ── */}
        {step === 5 && (
          <View>
            <Text style={S.docNote}>Upload clear photos of your documents. All uploads are optional but speed up approval.</Text>
            <View style={S.photoGrid}>
              <PhotoBlock label="Profile Photo" uri={profilePhoto} onPick={() => pickImage(setProfilePhoto)} />
              <PhotoBlock label="Driver's License" uri={licensePhoto} onPick={() => pickImage(setLicensePhoto)} />
              <PhotoBlock label="National ID" uri={nationalIdPhoto} onPick={() => pickImage(setNationalIdPhoto)} />
              <PhotoBlock label="Vehicle Photo" uri={vehiclePhoto} onPick={() => pickImage(setVehiclePhoto)} />
            </View>

            <View style={S.reviewCard}>
              <Text style={S.reviewTitle}>Review Summary</Text>
              <Text style={S.reviewLine}>👤 {fullName || '—'}</Text>
              <Text style={S.reviewLine}>📍 {city || '—'}</Text>
              <Text style={S.reviewLine}>🚗 {vehicleType} {vehicleMake ? `· ${vehicleMake}` : ''}</Text>
              <Text style={S.reviewLine}>🔖 {vehiclePlate || '—'}</Text>
              <Text style={S.reviewLine}>📋 License: {licenseNumber || '—'}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Footer CTA ── */}
      <View style={S.footer}>
        <TouchableOpacity
          style={[S.cta, loading && S.ctaOff]}
          onPress={step === TOTAL_STEPS ? handleSubmit : handleNext}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={S.ctaText}>
              {step === TOTAL_STEPS ? 'Submit Application ✓' : 'Continue →'}
            </Text>
          )}
        </TouchableOpacity>
        {step === TOTAL_STEPS && (
          <Text style={S.footerNote}>Your application will be reviewed within 24 hours</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#F5F5F5',
    alignItems: 'center', justifyContent: 'center',
  },
  backArrow: { fontSize: 20, color: COLORS.text },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerBrand: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  headerSub: { fontSize: 11, color: COLORS.gray, marginTop: 1 },

  progressTrack: {
    height: 4, backgroundColor: '#E8F5E9', marginHorizontal: 0,
  },
  progressFill: {
    height: 4, backgroundColor: COLORS.primary, borderRadius: 2,
  },
  dotRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingVertical: 10,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#DDD',
  },
  dotDone: { backgroundColor: COLORS.primary },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },

  stepHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#E8F5E9', borderRadius: 16,
    padding: 16, marginBottom: 24,
  },
  stepIconBox: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.white,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  stepIcon: { fontSize: 26 },
  stepTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
  stepTitleAm: { fontSize: 13, color: '#2E7D32', marginTop: 2 },

  label: {
    fontSize: 12, fontWeight: '700', color: COLORS.text,
    marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase',
    marginTop: 16,
  },
  input: {
    backgroundColor: '#F9F9F9', borderRadius: 14,
    borderWidth: 2, borderColor: '#ECECEC',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: COLORS.black,
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },
  inputMulti: { height: 90, textAlignVertical: 'top' },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 20, borderWidth: 2, borderColor: '#ECECEC',
    backgroundColor: '#F9F9F9',
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  chipTextActive: { color: COLORS.primary },

  sectionDivider: {
    marginTop: 24, marginBottom: 4,
    borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 16,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.gray, textTransform: 'uppercase', letterSpacing: 0.5 },

  cityScroll: { marginBottom: 12 },
  cityChip: {
    paddingHorizontal: 18, paddingVertical: 10, marginRight: 8,
    borderRadius: 20, borderWidth: 2, borderColor: '#ECECEC',
    backgroundColor: '#F9F9F9',
  },
  cityChipActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  cityChipText: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  cityChipTextActive: { color: COLORS.primary },
  selectedCity: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginBottom: 4 },

  vehicleGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4,
  },
  vehicleCard: {
    width: '29%', aspectRatio: 1,
    borderRadius: 16, borderWidth: 2, borderColor: '#ECECEC',
    backgroundColor: '#F9F9F9',
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleCardActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  vehicleIcon: { fontSize: 28, marginBottom: 4 },
  vehicleLabel: { fontSize: 11, fontWeight: '600', color: COLORS.text },
  vehicleLabelActive: { color: COLORS.primary },

  twoCol: { flexDirection: 'row', gap: 12 },
  colHalf: { flex: 1 },

  infoCard: {
    flexDirection: 'row', gap: 10,
    backgroundColor: '#EEF9EE', borderRadius: 14,
    padding: 14, marginTop: 20,
    borderWidth: 1, borderColor: '#C8E6C9',
  },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 13, color: '#2E7D32', lineHeight: 19 },

  docNote: {
    fontSize: 13, color: COLORS.gray, lineHeight: 19, marginBottom: 20,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  photoBlock: { width: '47%', alignItems: 'center' },
  photoBox: {
    width: '100%', aspectRatio: 1,
    borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#CCCCCC',
    backgroundColor: '#FAFAFA',
    alignItems: 'center', justifyContent: 'center',
  },
  photoBoxFilled: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9', borderStyle: 'solid' },
  photoPlus: { fontSize: 32, color: '#BBBBBB', lineHeight: 38 },
  photoHint: { fontSize: 11, color: '#AAAAAA', marginTop: 4 },
  photoCheck: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  photoLabel: { fontSize: 12, fontWeight: '600', color: COLORS.text, marginTop: 6, textAlign: 'center' },

  reviewCard: {
    backgroundColor: '#F9F9F9', borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: '#ECECEC',
  },
  reviewTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 12 },
  reviewLine: { fontSize: 13, color: COLORS.text, marginBottom: 6, lineHeight: 19 },

  footer: {
    paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0',
    backgroundColor: COLORS.white,
  },
  cta: {
    backgroundColor: COLORS.primary, borderRadius: 18,
    paddingVertical: 18, alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 8,
  },
  ctaOff: { opacity: 0.5, shadowOpacity: 0 },
  ctaText: { fontSize: 17, fontWeight: '800', color: COLORS.white, letterSpacing: 0.3 },
  footerNote: { fontSize: 12, color: COLORS.gray, textAlign: 'center', marginTop: 8 },
});
