import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, SafeAreaView,
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

    if (devCode) {
      setOtp(devCode);
    }

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      setError(`Enter the ${OTP_LENGTH}-digit code sent to ${phone}`);
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
        const { data } = await authAPI.verifyOtpRegister(phone, otp);
        navigation.navigate('CompleteProfile', {
          phone,
          verificationToken: data.data.verificationToken,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect code. Please try again.');
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
      if (data.data?.devCode) setOtp(data.data.devCode);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend. Please try again.');
    }
  };

  const boxes = Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] || '');
  const canVerify = otp.length === OTP_LENGTH && !isLoading;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Icon */}
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>📲</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Verify your number</Text>
        <Text style={styles.subtitle}>
          We sent a {OTP_LENGTH}-digit code to
        </Text>
        <Text style={styles.phone}>{phone}</Text>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorMsg}>{error}</Text>
          </View>
        )}

        {/* Hidden input */}
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={otp}
          onChangeText={(v) => { setOtp(v.replace(/\D/g, '').slice(0, OTP_LENGTH)); setError(''); }}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
        />

        {/* OTP Boxes */}
        <TouchableOpacity style={styles.boxRow} onPress={() => inputRef.current?.focus()} activeOpacity={1}>
          {boxes.map((digit, i) => {
            const isCursor = i === otp.length;
            const isFilled = !!digit;
            return (
              <View
                key={i}
                style={[
                  styles.box,
                  isCursor && styles.boxCursor,
                  isFilled && styles.boxFilled,
                ]}
              >
                <Text style={[styles.boxText, isFilled && styles.boxTextFilled]}>
                  {digit || (isCursor ? '|' : '')}
                </Text>
              </View>
            );
          })}
        </TouchableOpacity>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.verifyBtn, !canVerify && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={!canVerify}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={styles.verifyBtnText}>Verify & Continue</Text>
          )}
        </TouchableOpacity>

        {/* Resend */}
        <View style={styles.resendRow}>
          <Text style={styles.resendPrompt}>Didn't receive the code? </Text>
          <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
            <Text style={[styles.resendLink, countdown > 0 && styles.resendLinkDisabled]}>
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },

  header: {
    paddingHorizontal: 8, paddingTop: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.grayLighter,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },
  backIcon: { fontSize: 20, color: COLORS.text, lineHeight: 24 },

  body: {
    flex: 1, alignItems: 'center',
    paddingHorizontal: 32, paddingTop: 24,
  },

  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  icon: { fontSize: 36 },

  title: { fontSize: 26, fontWeight: '800', color: COLORS.black, textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 15, color: COLORS.gray, textAlign: 'center' },
  phone: { fontSize: 17, fontWeight: '700', color: COLORS.primary, marginTop: 4, marginBottom: 28 },

  errorBanner: {
    width: '100%', backgroundColor: '#FEF2F2',
    borderRadius: 12, padding: 14, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errorMsg: { color: '#991B1B', fontSize: 13 },

  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  boxRow: { flexDirection: 'row', gap: 10, marginBottom: 36 },
  box: {
    width: 46, height: 56, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  boxCursor: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  boxFilled: { borderColor: COLORS.primaryLight, backgroundColor: COLORS.white },
  boxText: { fontSize: 22, color: COLORS.gray },
  boxTextFilled: { fontWeight: '800', color: COLORS.primary },

  verifyBtn: {
    width: '100%', backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 17, alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  verifyBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  verifyBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  resendRow: { flexDirection: 'row', marginTop: 24, alignItems: 'center' },
  resendPrompt: { fontSize: 14, color: COLORS.gray },
  resendLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  resendLinkDisabled: { color: COLORS.gray, fontWeight: '500' },
});
