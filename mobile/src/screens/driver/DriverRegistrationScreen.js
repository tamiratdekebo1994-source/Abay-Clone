import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { driverAPI } from '../../services/api';
import api from '../../services/api';
import { useDispatch } from 'react-redux';
import { loadUser } from '../../store/authStore';
import { COLORS, ETHIOPIAN_CITIES, VEHICLE_TYPES } from '../../utils/constants';
import { t } from '../../utils/i18n';

const TOTAL_STEPS = 4;

export default function DriverRegistrationScreen({ navigation }) {
  const dispatch = useDispatch();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 – Personal/City
  const [city, setCity] = useState('');

  // Step 2 – Vehicle
  const [vehicleType, setVehicleType] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');

  // Step 3 – License
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');

  // Step 4 – Documents
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
      if (type === 'license') {
        setLicensePhoto(asset);
        uploadDocument(asset, 'license');
      } else {
        setIdPhoto(asset);
        uploadDocument(asset, 'id_card');
      }
    }
  };

  const takePicture = async (type) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85, allowsEditing: true,
    });

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
      formData.append('file', {
        uri: asset.uri,
        type: asset.mimeType || 'image/jpeg',
        name: `${docType}_${Date.now()}.jpg`,
      });
      await api.post(`/upload/driver/document/${docType}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch (err) {
      Alert.alert('Upload failed', err.response?.data?.message || 'Could not upload photo');
    } finally {
      setter(false);
    }
  };

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!city) { setError(t('selectCity')); return; }
    } else if (step === 2) {
      if (!vehicleType) { setError('Please select vehicle type'); return; }
      if (!vehiclePlate) { setError('Please enter license plate'); return; }
      if (!vehicleModel) { setError('Please enter vehicle model'); return; }
      if (!vehicleColor) { setError('Please enter vehicle color'); return; }
      if (!vehicleYear || isNaN(vehicleYear)) { setError('Please enter a valid year'); return; }
    } else if (step === 3) {
      if (!licenseNumber) { setError('Please enter license number'); return; }
      if (!licenseExpiry) { setError('Please enter license expiry date'); return; }
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
      // Create wallet automatically
      await api.get('/wallet').catch(() => {}); // Triggers wallet creation
      dispatch(loadUser());
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress Header */}
      <View style={styles.progressHeader}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : navigation.goBack()}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <View style={styles.progressInfo}>
          <Text style={styles.progressTitle}>{t('driverRegTitle')}</Text>
          <Text style={styles.progressStep}>{t('step')} {step} {t('of')} {TOTAL_STEPS}</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${(step / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        {/* ── Step 1: Select City ── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>{t('selectCity')}</Text>
            <Text style={styles.stepSubtitle}>ሾፌር የሚሰሩበት ከተማ ይምረጡ</Text>
            <View style={styles.cityGrid}>
              {ETHIOPIAN_CITIES.map((c) => (
                <TouchableOpacity
                  key={c.value}
                  style={[styles.cityBtn, city === c.value && styles.cityBtnActive]}
                  onPress={() => { setCity(c.value); setError(''); }}
                >
                  <Text style={[styles.cityBtnText, city === c.value && styles.cityBtnTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Step 2: Vehicle Info ── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>{t('vehicleInfo')}</Text>
            <Text style={styles.stepSubtitle}>የተሽከርካሪ መረጃ ያስገቡ</Text>

            <Text style={styles.label}>{t('vehicleType')} *</Text>
            <View style={styles.typeGrid}>
              {VEHICLE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v.value}
                  style={[styles.typeBtn, vehicleType === v.value && styles.typeBtnActive]}
                  onPress={() => { setVehicleType(v.value); setError(''); }}
                >
                  <Text style={styles.typeEmoji}>
                    {v.value === 'MOTORCYCLE' ? '🏍️' : v.value === 'BAJAJ' ? '🛺' : v.value === 'CAR' ? '🚗' : v.value === 'VAN' ? '🚐' : '🚚'}
                  </Text>
                  <Text style={[styles.typeLabel, vehicleType === v.value && styles.typeLabelActive]}>
                    {v.label.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field label={`${t('vehiclePlate')} *`} value={vehiclePlate} onChangeText={setVehiclePlate} placeholder="e.g. AA-12345" autoCapitalize="characters" />
            <Field label={`${t('vehicleModel')} *`} value={vehicleModel} onChangeText={setVehicleModel} placeholder="e.g. Honda CB150R, Toyota Corolla" />
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field label={`${t('vehicleColor')} *`} value={vehicleColor} onChangeText={setVehicleColor} placeholder="e.g. Red" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={`${t('vehicleYear')} *`} value={vehicleYear} onChangeText={setVehicleYear} placeholder="2020" keyboardType="number-pad" maxLength={4} />
              </View>
            </View>
          </View>
        )}

        {/* ── Step 3: License ── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>{t('licenseInfo')}</Text>
            <Text style={styles.stepSubtitle}>የሾፌር ፍቃድ መረጃ ያስገቡ</Text>
            <Field label={`${t('licenseNumber')} *`} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="e.g. ETH-001234" autoCapitalize="characters" />
            <Field
              label={`${t('licenseExpiry')} *`}
              value={licenseExpiry}
              onChangeText={setLicenseExpiry}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
            />
          </View>
        )}

        {/* ── Step 4: Documents ── */}
        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>{t('documents')}</Text>
            <Text style={styles.stepSubtitle}>ሰነዶችዎን ይስቀሉ (አማራጭ — ኋላ ማስገባት ይቻላል)</Text>

            <DocUploadBox
              label={t('uploadLicense')}
              subLabel="የሾፌር ፍቃድ ፎቶ"
              photo={licensePhoto}
              isUploading={uploadingLicense}
              onPickPhoto={() => pickImage('license')}
              onTakePhoto={() => takePicture('license')}
            />
            <DocUploadBox
              label={t('uploadId')}
              subLabel="የሀገር መታወቂያ ፎቶ"
              photo={idPhoto}
              isUploading={uploadingId}
              onPickPhoto={() => pickImage('id_card')}
              onTakePhoto={() => takePicture('id_card')}
            />

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                📋 Documents help us verify your identity and approve your application faster.
                You can also upload them later from your profile.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Button */}
      <View style={styles.bottomBar}>
        {step < TOTAL_STEPS ? (
          <TouchableOpacity style={styles.nextBtn} onPress={nextStep}>
            <Text style={styles.nextBtnText}>{t('next')} →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.nextBtn, isLoading && styles.nextBtnDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.nextBtnText}>{t('submit')} ✓</Text>}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const Field = ({ label, value, onChangeText, placeholder, ...props }) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={fieldStyles.label}>{label}</Text>
    <TextInput
      style={fieldStyles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.gray}
      {...props}
    />
  </View>
);

const DocUploadBox = ({ label, subLabel, photo, isUploading, onPickPhoto, onTakePhoto }) => (
  <View style={docStyles.container}>
    <Text style={docStyles.label}>{label}</Text>
    <Text style={docStyles.subLabel}>{subLabel}</Text>
    {photo ? (
      <View style={docStyles.preview}>
        <Image source={{ uri: photo.uri }} style={docStyles.previewImage} />
        {isUploading && (
          <View style={docStyles.uploadingOverlay}>
            <ActivityIndicator color={COLORS.white} />
            <Text style={docStyles.uploadingText}>Uploading...</Text>
          </View>
        )}
        {!isUploading && <Text style={docStyles.uploadedBadge}>✓ Uploaded</Text>}
      </View>
    ) : (
      <View style={docStyles.uploadBtns}>
        <TouchableOpacity style={docStyles.uploadBtn} onPress={onTakePhoto}>
          <Text style={docStyles.uploadBtnIcon}>📷</Text>
          <Text style={docStyles.uploadBtnText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={docStyles.uploadBtn} onPress={onPickPhoto}>
          <Text style={docStyles.uploadBtnIcon}>🖼️</Text>
          <Text style={docStyles.uploadBtnText}>From Gallery</Text>
        </TouchableOpacity>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  progressHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12,
  },
  backBtn: { fontSize: 24, color: COLORS.primary, width: 32 },
  progressInfo: { flex: 1, alignItems: 'center' },
  progressTitle: { fontSize: 16, fontWeight: '700', color: COLORS.black },
  progressStep: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  placeholder: { width: 32 },
  progressBarBg: { height: 4, backgroundColor: COLORS.grayLight, marginHorizontal: 20 },
  progressBarFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2, transition: 'width 0.3s' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 24 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: COLORS.error, fontSize: 13 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: COLORS.black, marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 24 },
  cityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cityBtn: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: COLORS.grayLighter,
  },
  cityBtnActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  cityBtnText: { fontSize: 13, color: COLORS.gray, fontWeight: '500' },
  cityBtnTextActive: { color: COLORS.primary, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  typeGrid: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn: {
    flex: 1, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    backgroundColor: COLORS.grayLighter,
  },
  typeBtnActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  typeEmoji: { fontSize: 22, marginBottom: 4 },
  typeLabel: { fontSize: 11, color: COLORS.gray, fontWeight: '600', textAlign: 'center' },
  typeLabelActive: { color: COLORS.primary },
  row: { flexDirection: 'row' },
  infoBox: { backgroundColor: '#FEF9C3', borderRadius: 10, padding: 14, marginTop: 16 },
  infoText: { color: '#713F12', fontSize: 13, lineHeight: 20 },
  bottomBar: { padding: 20, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.grayLight },
  nextBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  nextBtnDisabled: { opacity: 0.6 },
  nextBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
});

const fieldStyles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, fontSize: 15, backgroundColor: COLORS.grayLighter, color: COLORS.text,
  },
});

const docStyles = StyleSheet.create({
  container: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    padding: 16, marginBottom: 16, backgroundColor: COLORS.grayLighter,
  },
  label: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  subLabel: { fontSize: 12, color: COLORS.gray, marginBottom: 12 },
  uploadBtns: { flexDirection: 'row', gap: 10 },
  uploadBtn: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    borderStyle: 'dashed', padding: 16, alignItems: 'center',
    backgroundColor: COLORS.white,
  },
  uploadBtnIcon: { fontSize: 28, marginBottom: 4 },
  uploadBtnText: { fontSize: 12, color: COLORS.gray, fontWeight: '500' },
  preview: { borderRadius: 10, overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: 150, borderRadius: 10 },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', borderRadius: 10,
  },
  uploadingText: { color: COLORS.white, marginTop: 8, fontSize: 13 },
  uploadedBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: COLORS.success, color: COLORS.white,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, fontSize: 12, fontWeight: '700',
  },
});
