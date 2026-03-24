import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import api from '../services/api';
import { COLORS, PAYMENT_METHODS } from '../utils/constants';
import { t } from '../utils/i18n';

const STATUS_COLORS = {
  PENDING: '#F59E0B', APPROVED: '#3B82F6',
  COMPLETED: '#10B981', FAILED: '#EF4444',
};

export default function WalletScreen() {
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

  if (isLoading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadWallet(); }} colors={[COLORS.primary]} />}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('balance')}</Text>
          <Text style={styles.balanceAmount}>ETB {wallet?.balance?.toFixed(2) || '0.00'}</Text>
          {wallet?.pendingAmount > 0 && (
            <Text style={styles.pendingText}>⏳ ETB {wallet.pendingAmount.toFixed(2)} pending</Text>
          )}
          <TouchableOpacity
            style={styles.withdrawBtn}
            onPress={() => setShowWithdraw(true)}
            disabled={!wallet?.balance || wallet.balance < 100}
          >
            <Text style={styles.withdrawBtnText}>💸 {t('withdrawFunds')}</Text>
          </TouchableOpacity>
        </View>

        {/* Min info */}
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{t('minWithdrawal')}</Text>
          <Text style={styles.infoText}>Payments processed within 24 hours</Text>
        </View>

        {/* Withdrawal History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal History / የሂሳብ ታሪክ</Text>
          {wallet?.withdrawals?.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No withdrawals yet</Text>
            </View>
          ) : (
            wallet?.withdrawals?.map((w) => (
              <View key={w.id} style={styles.withdrawalRow}>
                <View>
                  <Text style={styles.withdrawalMethod}>{w.method.replace('_', ' ')}</Text>
                  <Text style={styles.withdrawalAccount}>{w.accountNumber}</Text>
                  <Text style={styles.withdrawalDate}>
                    {new Date(w.createdAt).toLocaleDateString('en-ET')}
                  </Text>
                </View>
                <View style={styles.withdrawalRight}>
                  <Text style={styles.withdrawalAmount}>ETB {w.amount.toFixed(2)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[w.status] + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[w.status] }]}>{w.status}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal visible={showWithdraw} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('withdrawFunds')}</Text>
            <TouchableOpacity onPress={() => setShowWithdraw(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.availableLabel}>Available: ETB {wallet?.balance?.toFixed(2)}</Text>

            <ModalField
              label={`Amount (ETB) *`}
              value={withdrawForm.amount}
              onChangeText={(v) => setWithdrawForm((p) => ({ ...p, amount: v }))}
              placeholder="Minimum ETB 100"
              keyboardType="decimal-pad"
            />

            <Text style={styles.fieldLabel}>Payment Method *</Text>
            <View style={styles.methodGrid}>
              {PAYMENT_METHODS.filter(m => m.value !== 'CASH').map((method) => (
                <TouchableOpacity
                  key={method.value}
                  style={[styles.methodBtn, withdrawForm.method === method.value && styles.methodBtnActive]}
                  onPress={() => setWithdrawForm((p) => ({ ...p, method: method.value }))}
                >
                  <Text style={styles.methodEmoji}>{method.icon}</Text>
                  <Text style={[styles.methodLabel, withdrawForm.method === method.value && styles.methodLabelActive]}>
                    {method.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ModalField
              label={`${t('accountNumber')} *`}
              value={withdrawForm.accountNumber}
              onChangeText={(v) => setWithdrawForm((p) => ({ ...p, accountNumber: v }))}
              placeholder="+251XXXXXXXXX or account number"
              keyboardType="phone-pad"
            />
            <ModalField
              label={`${t('accountName')} *`}
              value={withdrawForm.accountName}
              onChangeText={(v) => setWithdrawForm((p) => ({ ...p, accountName: v }))}
              placeholder="Name on account"
            />

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
              onPress={handleWithdraw}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.submitBtnText}>Submit Withdrawal Request</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const ModalField = ({ label, value, onChangeText, placeholder, ...props }) => (
  <View style={{ marginBottom: 16 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.fieldInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={COLORS.gray}
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  balanceCard: {
    margin: 16, backgroundColor: COLORS.primary, borderRadius: 20, padding: 24, alignItems: 'center',
  },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  balanceAmount: { color: COLORS.accent, fontSize: 44, fontWeight: '800', marginVertical: 8 },
  pendingText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 8 },
  withdrawBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8,
  },
  withdrawBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 15 },
  infoBox: { marginHorizontal: 16, backgroundColor: '#FEF9C3', borderRadius: 10, padding: 12, marginBottom: 16 },
  infoText: { color: '#713F12', fontSize: 12, marginBottom: 2 },
  section: { margin: 16, marginTop: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  emptyState: { backgroundColor: COLORS.white, borderRadius: 12, padding: 24, alignItems: 'center' },
  emptyText: { color: COLORS.gray, fontSize: 15 },
  withdrawalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  withdrawalMethod: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  withdrawalAccount: { fontSize: 13, color: COLORS.gray },
  withdrawalDate: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  withdrawalRight: { alignItems: 'flex-end' },
  withdrawalAmount: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: COLORS.white },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.grayLight, paddingTop: 32,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.black },
  modalClose: { fontSize: 22, color: COLORS.gray },
  modalContent: { padding: 20 },
  availableLabel: { fontSize: 16, fontWeight: '600', color: COLORS.primary, marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, fontSize: 15, backgroundColor: COLORS.grayLighter, color: COLORS.text,
  },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  methodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.grayLighter,
  },
  methodBtnActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
  methodEmoji: { fontSize: 18 },
  methodLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
  methodLabelActive: { color: COLORS.primary },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 32,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
});
