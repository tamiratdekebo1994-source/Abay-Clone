import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
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

  const handleCreate = async () => {
    if (!fullName.trim()) { setError('Please enter your full name'); return; }
    if (!role) { setError('Please select your role'); return; }

    setIsLoading(true);
    setError('');

    try {
      const { data } = await authAPI.completeRegistration({
        verificationToken, fullName: fullName.trim(), role, email: email.trim() || undefined,
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t('createAccount')}</Text>
      <Text style={styles.subtitle}>Phone verified ✓ {phone}</Text>

      {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

      <View style={styles.field}>
        <Text style={styles.label}>{t('fullName')} *</Text>
        <TextInput
          style={styles.input}
          placeholder={t('fullNamePlaceholder')}
          value={fullName}
          onChangeText={(v) => { setFullName(v); setError(''); }}
          autoCapitalize="words"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t('email')}</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>I am a... / እኔ ነኝ...</Text>
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'DRIVER' && styles.roleBtnActive]}
            onPress={() => { setRole('DRIVER'); setError(''); }}
          >
            <Text style={styles.roleEmoji}>🚗</Text>
            <Text style={[styles.roleLabel, role === 'DRIVER' && styles.roleLabelActive]}>
              {t('iAmDriver')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.roleBtn, role === 'STORE' && styles.roleBtnActive]}
            onPress={() => { setRole('STORE'); setError(''); }}
          >
            <Text style={styles.roleEmoji}>🏪</Text>
            <Text style={[styles.roleLabel, role === 'STORE' && styles.roleLabelActive]}>
              {t('iAmStore')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btn, isLoading && styles.btnDisabled]}
        onPress={handleCreate}
        disabled={isLoading}
      >
        {isLoading ? <ActivityIndicator color={COLORS.white} /> : (
          <Text style={styles.btnText}>{t('createAccount')} →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: 24, paddingTop: 60 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.black, marginBottom: 6 },
  subtitle: { color: COLORS.success, fontSize: 14, marginBottom: 24, fontWeight: '600' },
  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16 },
  errorText: { color: COLORS.error, fontSize: 13 },
  field: { marginBottom: 18 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, fontSize: 16, backgroundColor: COLORS.grayLighter, color: COLORS.text,
  },
  roleRow: { flexDirection: 'row', gap: 12 },
  roleBtn: {
    flex: 1, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 14, padding: 16, alignItems: 'center',
    backgroundColor: COLORS.grayLighter,
  },
  roleBtnActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  roleEmoji: { fontSize: 32, marginBottom: 6 },
  roleLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray, textAlign: 'center' },
  roleLabelActive: { color: COLORS.primary },
  btn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
});
