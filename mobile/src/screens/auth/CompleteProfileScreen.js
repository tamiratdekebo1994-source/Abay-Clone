import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, SafeAreaView,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useDispatch } from 'react-redux';
import { authAPI } from '../../services/api';
import { loadUser } from '../../store/authStore';
import { COLORS } from '../../utils/constants';
import { t } from '../../utils/i18n';

export default function CompleteProfileScreen({ navigation, route }) {
  const { phone, verificationToken } = route.params;
  const dispatch = useDispatch();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);

  const handleCreate = async () => {
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
    if (!role) { setError('Please select your role to continue.'); return; }

    setIsLoading(true);
    setError('');
    try {
      const { data } = await authAPI.completeRegistration({
        verificationToken,
        fullName: fullName.trim(),
        role,
        email: email.trim() || undefined,
      });

      await SecureStore.setItemAsync('accessToken', data.data.accessToken);
      await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);

      if (role === 'DRIVER') {
        navigation.replace('DriverRegistration');
      } else {
        dispatch(loadUser());
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotDone]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={styles.stepDot} />
          </View>
          <Text style={styles.stepLabel}>Step 2 of 3 — Profile Setup</Text>
        </View>

        {/* Verified Badge */}
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedIcon}>✓</Text>
          <Text style={styles.verifiedText}>Phone verified · {phone}</Text>
        </View>

        <Text style={styles.title}>Complete your profile</Text>
        <Text style={styles.subtitle}>Tell us a bit about yourself to get started</Text>

        {/* Error */}
        {!!error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorMsg}>{error}</Text>
          </View>
        )}

        {/* Full Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>{t('fullName')} *</Text>
          <TextInput
            style={[styles.input, nameFocused && styles.inputFocused]}
            placeholder="e.g. Abebe Kebede"
            value={fullName}
            onChangeText={(v) => { setFullName(v); setError(''); }}
            autoCapitalize="words"
            placeholderTextColor={COLORS.gray}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
          />
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            {t('email')}
            <Text style={styles.optional}> (optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, emailFocused && styles.inputFocused]}
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={COLORS.gray}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />
        </View>

        {/* Role */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>I am joining as... *</Text>
          <View style={styles.roleRow}>
            <TouchableOpacity
              style={[styles.roleCard, role === 'DRIVER' && styles.roleCardActive]}
              onPress={() => { setRole('DRIVER'); setError(''); }}
              activeOpacity={0.8}
            >
              <View style={[styles.roleIconWrap, role === 'DRIVER' && styles.roleIconWrapActive]}>
                <Text style={styles.roleIcon}>🚚</Text>
              </View>
              <Text style={[styles.roleTitle, role === 'DRIVER' && styles.roleTitleActive]}>Driver</Text>
              <Text style={[styles.roleDesc, role === 'DRIVER' && styles.roleDescActive]}>
                Deliver orders & earn money
              </Text>
              {role === 'DRIVER' && <View style={styles.roleCheck}><Text style={styles.roleCheckText}>✓</Text></View>}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, role === 'STORE' && styles.roleCardActive]}
              onPress={() => { setRole('STORE'); setError(''); }}
              activeOpacity={0.8}
            >
              <View style={[styles.roleIconWrap, role === 'STORE' && styles.roleIconWrapActive]}>
                <Text style={styles.roleIcon}>🏪</Text>
              </View>
              <Text style={[styles.roleTitle, role === 'STORE' && styles.roleTitleActive]}>Store</Text>
              <Text style={[styles.roleDesc, role === 'STORE' && styles.roleDescActive]}>
                Manage your business orders
              </Text>
              {role === 'STORE' && <View style={styles.roleCheck}><Text style={styles.roleCheckText}>✓</Text></View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
          onPress={handleCreate}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing you agree to Fetno's Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  scroll: { flex: 1 },
  content: { padding: 24, paddingTop: 20, paddingBottom: 48 },

  /* Step indicator */
  topBar: { alignItems: 'center', marginBottom: 24 },
  stepIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.grayLight,
  },
  stepDotDone: { backgroundColor: COLORS.primaryLighter },
  stepDotActive: { backgroundColor: COLORS.primary, width: 14, height: 14, borderRadius: 7 },
  stepLine: { width: 48, height: 2, backgroundColor: COLORS.grayLight, marginHorizontal: 4 },
  stepLabel: { fontSize: 12, color: COLORS.gray, fontWeight: '500' },

  /* Verified */
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E8F5E9', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 24, alignSelf: 'flex-start',
  },
  verifiedIcon: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.primary,
    color: COLORS.white, fontSize: 12, fontWeight: '800',
    textAlign: 'center', lineHeight: 20,
  },
  verifiedText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  title: { fontSize: 24, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.gray, marginBottom: 28 },

  /* Error */
  errorBanner: {
    backgroundColor: '#FEF2F2', borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderLeftWidth: 3, borderLeftColor: COLORS.error,
  },
  errorMsg: { color: '#991B1B', fontSize: 13 },

  /* Fields */
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  optional: { fontWeight: '400', color: COLORS.gray },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, backgroundColor: '#FAFAFA', color: COLORS.text,
  },
  inputFocused: { borderColor: COLORS.primary, backgroundColor: COLORS.white },

  /* Role Cards */
  roleRow: { flexDirection: 'row', gap: 12 },
  roleCard: {
    flex: 1, borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 16, padding: 16, alignItems: 'center',
    backgroundColor: '#FAFAFA', position: 'relative',
  },
  roleCardActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  roleIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.grayLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  roleIconWrapActive: { backgroundColor: 'rgba(27,67,50,0.12)' },
  roleIcon: { fontSize: 26 },
  roleTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  roleTitleActive: { color: COLORS.primary },
  roleDesc: { fontSize: 12, color: COLORS.gray, textAlign: 'center', lineHeight: 16 },
  roleDescActive: { color: COLORS.primaryLight },
  roleCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  roleCheckText: { color: COLORS.white, fontSize: 12, fontWeight: '800' },

  /* Submit */
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
    marginTop: 8, marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.6, shadowOpacity: 0 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  terms: { fontSize: 12, color: COLORS.gray, textAlign: 'center', lineHeight: 18 },
});
