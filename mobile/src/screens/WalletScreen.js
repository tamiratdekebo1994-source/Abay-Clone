import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSelector } from 'react-redux';
import api from '../services/api';
import { COLORS, PAYMENT_METHODS } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t } from '../utils/i18n';

const STATUS_COLORS = {
  PENDING: '#F59E0B', APPROVED: '#3B82F6',
  COMPLETED: '#10B981', FAILED: '#EF4444',
};

export default function WalletScreen() {
  const theme = useSelector((state) => state.settings.theme);
  const C = getColors(theme);
  const [wallet, setWallet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    amount: '', method: 'TELEBIRR', accountNumber: '', accountName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadWallet(); }, []);

  const loadWallet = async () => {
    try {
      const { data } = await api.get('/wallet');
      setWallet(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const handleWithdraw = async () => {
    const { amount, method, accountNumber, accountName } = withdrawForm;
    if (!amount || parseFloat(amount) < 100) {
      Alert.alert('Error', t('minWithdrawal')); return;
    }
    if (!accountNumber.trim() || !accountName.trim()) {
      Alert.alert('Error', 'Please fill in all fields'); return;
    }
    setIsSubmitting(true);
    try {
      await api.post('/wallet/withdraw', {
        amount: parseFloat(amount), method, accountNumber, accountName,
      });
      Alert.alert('✅ Submitted!', 'Your withdrawal request has been submitted. Processing within 24 hours.');
      setShowWithdraw(false);
      setWithdrawForm({ amount: '', method: 'TELEBIRR', accountNumber: '', accountName: '' });
      loadWallet();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit withdrawal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const S = getStyles(C);

  if (isLoading) {
    return <View style={S.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <>
      <ScrollView
        style={S.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadWallet(); }} colors={[COLORS.primary]} />}
      >
        <View style={S.balanceCard}>
          <Text style={S.balanceLabel}>{t('balance')}</Text>
          <Text style={S.balanceAmount}>ETB {wallet?.balance?.toFixed(2) || '0.00'}</Text>
          {wallet?.pendingAmount > 0 && (
            <Text style={S.pendingText}>⏳ ETB {wallet.pendingAmount.toFixed(2)} pending</Text>
          )}
          <TouchableOpacity
            style={S.withdrawBtn}
            onPress={() => setShowWithdraw(true)}
            disabled={!wallet?.balance || wallet.balance < 100}
          >
            <Text style={S.withdrawBtnText}>💸 {t('withdrawFunds')}</Text>
          </TouchableOpacity>
        </View>

        <View style={S.infoBox}>
          <Text style={S.infoText}>{t('minWithdrawal')}</Text>
          <Text style={S.infoText}>Payments processed within 24 hours</Text>
        </View>

        <View style={S.section}>
          <Text style={S.sectionTitle}>Withdrawal History / የሂሳብ ታሪክ</Text>
          {wallet?.withdrawals?.length === 0 ? (
            <View style={S.emptyState}>
              <Text style={S.emptyText}>No withdrawals yet</Text>
            </View>
          ) : (
            wallet?.withdrawals?.map((w) => (
              <View key={w.id} style={S.withdrawalRow}>
                <View>
                  <Text style={S.withdrawalMethod}>{w.method.replace('_', ' ')}</Text>
                  <Text style={S.withdrawalAccount}>{w.accountNumber}</Text>
                  <Text style={S.withdrawalDate}>
                    {new Date(w.createdAt).toLocaleDateString('en-ET')}
                  </Text>
                </View>
                <View style={S.withdrawalRight}>
                  <Text style={S.withdrawalAmount}>ETB {w.amount.toFixed(2)}</Text>
                  <View style={[S.statusBadge, { backgroundColor: STATUS_COLORS[w.status] + '20' }]}>
                    <Text style={[S.statusText, { color: STATUS_COLORS[w.status] }]}>{w.status}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showWithdraw} animationType="slide" presentationStyle="pageSheet">
        <View style={S.modal}>
          <View style={S.modalHeader}>
            <Text style={S.modalTitle}>{t('withdrawFunds')}</Text>
            <TouchableOpacity onPress={() => setShowWithdraw(false)}>
              <Text style={S.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={S.modalContent}>
            <Text style={S.availableLabel}>Available: ETB {wallet?.balance?.toFixed(2)}</Text>
            <ModalField label="Amount (ETB) *" value={withdrawForm.amount} onChangeText={(v) => setWithdrawForm((p) => ({ ...p, amount: v }))} placeholder="Minimum ETB 100" keyboardType="decimal-pad" C={C} />
            <Text style={S.fieldLabel}>Payment Method *</Text>
            <View style={S.methodGrid}>
              {PAYMENT_METHODS.filter(m => m.value !== 'CASH').map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[S.methodBtn, withdrawForm.method === method.value && S.methodBtnActive]}
                  onPress={() => setWithdrawForm((p) => ({ ...p, method: method.value }))}
                >
                  <Text style={S.methodEmoji}>{method.icon}</Text>
                  <Text style={[S.methodLabel, withdrawForm.method === method.value && S.methodLabelActive]}>
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <ModalField label={`${t('accountNumber')} *`} value={withdrawForm.accountNumber} onChangeText={(v) => setWithdrawForm((p) => ({ ...p, accountNumber: v }))} placeholder="+251XXXXXXXXX or account number" keyboardType="phone-pad" C={C} />
            <ModalField label={`${t('accountName')} *`} value={withdrawForm.accountName} onChangeText={(v) => setWithdrawForm((p) => ({ ...p, accountName: v }))} placeholder="Name on account" C={C} />
            <TouchableOpacity style={[S.submitBtn, isSubmitting && S.submitBtnDisabled]} onPress={handleWithdraw} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color={COLORS.white} /> : <Text style={S.submitBtnText}>Submit Withdrawal Request</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const ModalField = ({ label, value, onChangeText, placeholder, C, ...props }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={{ fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 }}>{label}</Text>
    <TextInput
      style={{ borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: C.grayLighter, color: C.text }}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.gray}
      {...props}
    />
  </View>
);

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
  balanceCard: { margin: 16, backgroundColor: COLORS.primary, borderRadius: 20, padding: 24, alignItems: 'center' },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  balanceAmount: { color: COLORS.accent, fontSize: 44, fontWeight: '800', marginVertical: 8 },
  pendingText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 },
  withdrawBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  withdrawBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 15 },
  infoBox: { marginHorizontal: 16, backgroundColor: C.grayLighter, borderRadius: 10, padding: 12, marginBottom: 16 },
  infoText: { color: C.gray, fontSize: 12, marginBottom: 2 },
  section: { margin: 16, marginTop: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
  emptyState: { backgroundColor: C.white, borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { color: C.gray, fontSize: 15 },
  withdrawalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, padding: 14, marginBottom: 8 },
  withdrawalMethod: { fontSize: 14, fontWeight: '700', color: C.text },
  withdrawalAccount: { fontSize: 13, color: C.gray },
  withdrawalDate: { fontSize: 11, color: C.gray, marginTop: 2 },
  withdrawalRight: { alignItems: 'flex-end' },
  withdrawalAmount: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: C.white },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.grayLight, paddingTop: 32 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  modalClose: { fontSize: 22, color: C.gray },
  modalContent: { padding: 20 },
  availableLabel: { fontSize: 16, fontWeight: '600', color: COLORS.primary, marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 6 },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  methodBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.grayLighter },
  methodBtnActive: { borderColor: COLORS.primary, backgroundColor: C.grayLight },
  methodEmoji: { fontSize: 18 },
  methodLabel: { fontSize: 13, fontWeight: '600', color: C.gray },
  methodLabelActive: { color: COLORS.primary },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 32 },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
