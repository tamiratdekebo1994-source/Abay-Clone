import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { authAPI } from '../../services/api';
import * as SecureStore from 'expo-secure-store';
import { loadUser } from '../../store/authStore';
import { COLORS } from '../../utils/constants';
import { t } from '../../utils/i18n';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OtpVerificationScreen({ navigation, route }) {
  const { phone, purpose, devCode } = route.params;
  const dispatch = useDispatch();

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();

    // Show dev code hint in development
    if (devCode) {
      Alert.alert('Dev Mode 🔧', `OTP Code: ${devCode}`, [{ text: 'Copy & Fill', onPress: () => setOtp(devCode) }]);
    }

    const timer = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setError(`Please enter the ${OTP_LENGTH}-digit code`);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      if (purpose === 'LOGIN') {
        const { data } = await authAPI.verifyOtpLogin(phone, otp);
        await SecureStore.setItemAsync('accessToken', data.data.accessToken);
        await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
        dispatch(loadUser());
      } else {
        // REGISTER — verify OTP, get verification token, proceed to profile setup
        const { data } = await authAPI.verifyOtpRegister(phone, otp);
        navigation.navigate('CompleteProfile', {
          phone,
          verificationToken: data.data.verificationToken,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      const { data } = await authAPI.requestOtp(phone, purpose);
      setCountdown(RESEND_COOLDOWN);
      setOtp('');
      setError('');
      if (data.data?.devCode) {
        Alert.alert('Dev Mode 🔧', `New OTP: ${data.data.devCode}`, [{ text: 'Fill', onPress: () => setOtp(data.data.devCode) }]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend');
    }
  };

  // Render OTP boxes
  const boxes = Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] || '');

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← {t('back')}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.emoji}>📱</Text>
        <Text style={styles.title}>{t('enterOtp')}</Text>
        <Text style={styles.subtitle}>{t('otpSent')}</Text>
        <Text style={styles.phone}>{phone}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* OTP Input — hidden, drives visual boxes */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={otp}
          onChangeText={(t) => { setOtp(t.replace(/\D/g, '').slice(0, OTP_LENGTH)); setError(''); }}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
        />

        {/* Visual OTP Boxes */}
        <TouchableOpacity style={styles.boxRow} onPress={() => inputRef.current?.focus()} activeOpacity={1}>
          {boxes.map((digit, idx) => (
            <View
              key={idx}
              style={[
                styles.box,
                idx === otp.length && styles.boxActive,
                digit && styles.boxFilled,
              ]}
            >
              <Text style={styles.boxText}>{digit || (idx === otp.length ? '|' : '')}</Text>
            </View>
          ))}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.verifyBtn, (isLoading || otp.length < OTP_LENGTH) && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={isLoading || otp.length < OTP_LENGTH}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.verifyBtnText}>{t('verify')} ✓</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={countdown > 0}>
          <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
            {countdown > 0
              ? `Resend in ${countdown}s`
              : t('otpResend')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  backBtn: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 8 },
  backText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 20, alignItems: 'center' },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.black, textAlign: 'center' },
  subtitle: { color: COLORS.gray, marginTop: 8, fontSize: 15 },
  phone: { color: COLORS.primary, fontSize: 18, fontWeight: '700', marginTop: 4 },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginTop: 16, width: '100%' },
  errorText: { color: COLORS.error, fontSize: 13, textAlign: 'center' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  boxRow: { flexDirection: 'row', gap: 10, marginTop: 32, marginBottom: 32 },
  box: {
    width: 48, height: 58, borderRadius: 12,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.grayLighter,
  },
  boxActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  boxFilled: { borderColor: COLORS.primaryLight, backgroundColor: '#E8F5E9' },
  boxText: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  verifyBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 48, width: '100%',
    alignItems: 'center',
  },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  resendBtn: { marginTop: 20 },
  resendText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  resendTextDisabled: { color: COLORS.gray },
});
