import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

export default function EarningsSummary({ earnings }) {
  if (!earnings) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Earnings / ዛሬ ያገኘሁት</Text>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={styles.amount}>ETB {earnings.total?.toFixed(0) || '0'}</Text>
          <Text style={styles.label}>Earned</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.amount}>{earnings.deliveries || 0}</Text>
          <Text style={styles.label}>Trips</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.amount}>ETB {earnings.averagePerDelivery?.toFixed(0) || '0'}</Text>
          <Text style={styles.label}>Avg/Trip</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16, backgroundColor: COLORS.white,
    borderRadius: 12, padding: 16,
    borderLeftWidth: 4, borderLeftColor: COLORS.accent,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 3, elevation: 2,
  },
  title: { fontSize: 13, fontWeight: '600', color: COLORS.gray, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, alignItems: 'center' },
  amount: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  label: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: COLORS.grayLight },
});
