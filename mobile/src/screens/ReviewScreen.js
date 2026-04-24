import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useSelector } from 'react-redux';
import { orderAPI } from '../services/api';
import { COLORS } from '../utils/constants';
import { getColors } from '../utils/theme';

export default function ReviewScreen({ route, navigation }) {
  const { orderId, order } = route.params || {};
  const theme = useSelector((s) => s.settings.theme);
  const C = getColors(theme);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hovered, setHovered] = useState(0);

  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
  const LABELS_AM = ['', 'መጥፎ', 'ደካማ', 'ጥሩ', 'በጣም ጥሩ', 'አስደናቂ'];

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating.\nእባክዎ ደረጃ ይምረጡ።');
      return;
    }
    try {
      setIsSubmitting(true);
      await orderAPI.submitReview(orderId, { rating, comment });
      Alert.alert(
        '🎉 Review Submitted!',
        'Thank you for your feedback.\nለአስተያየትዎ እናመሰግናለን።',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayRating = hovered || rating;
  const styles = getStyles(C);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Order Header */}
      <View style={styles.orderCard}>
        <Text style={styles.orderNum}>Order #{order?.orderNumber}</Text>
        <Text style={styles.orderAddress} numberOfLines={1}>📦 {order?.deliveryAddress}</Text>
        <Text style={styles.orderFee}>ETB {order?.driverFee?.toFixed(2)} earned</Text>
      </View>

      {/* Rating */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Rate this delivery</Text>
        <Text style={styles.sectionTitleAm}>ይህን ማድረስ ይምዘኑ</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setRating(star)}
              onPressIn={() => setHovered(star)}
              onPressOut={() => setHovered(0)}
              style={styles.starBtn}
              activeOpacity={0.7}
            >
              <Text style={[styles.star, displayRating >= star && styles.starActive]}>
                {displayRating >= star ? '★' : '☆'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {displayRating > 0 && (
          <View style={styles.ratingLabel}>
            <Text style={styles.ratingLabelText}>{LABELS[displayRating]}</Text>
            <Text style={styles.ratingLabelAm}>{LABELS_AM[displayRating]}</Text>
          </View>
        )}
      </View>

      {/* Comment */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Comment (optional)</Text>
        <Text style={styles.sectionTitleAm}>አስተያየት (አማራጭ)</Text>
        <TextInput
          style={styles.commentInput}
          multiline
          numberOfLines={4}
          maxLength={300}
          value={comment}
          onChangeText={setComment}
          placeholder="Describe your experience... / ልምድዎን ይግለጹ..."
          placeholderTextColor={C.gray}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{comment.length}/300</Text>
      </View>

      {/* Quick tags */}
      <View style={styles.section}>
        <Text style={styles.quickLabel}>Quick tags:</Text>
        <View style={styles.quickTags}>
          {['Fast delivery', 'Careful handling', 'Professional', 'On time', 'Excellent communication'].map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tag, comment.includes(tag) && styles.tagActive]}
              onPress={() =>
                setComment((prev) =>
                  prev.includes(tag) ? prev.replace(tag, '').trim() : `${prev} ${tag}`.trim()
                )
              }
            >
              <Text style={[styles.tagText, comment.includes(tag) && styles.tagTextActive]}>{tag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, (rating === 0 || isSubmitting) && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={rating === 0 || isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <>
            <Text style={styles.submitText}>Submit Review</Text>
            <Text style={styles.submitTextAm}>ግምገማ አስገባ</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.skipText}>Skip for now / አሁን ይዝለሉ</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { padding: 16 },
  orderCard: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, marginBottom: 20 },
  orderNum: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginBottom: 4 },
  orderAddress: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  orderFee: { color: COLORS.accent, fontSize: 14, fontWeight: '700', marginTop: 6 },
  section: {
    backgroundColor: C.white, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  sectionTitleAm: { fontSize: 13, color: C.gray, marginTop: 2, marginBottom: 16 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 },
  starBtn: { padding: 4 },
  star: { fontSize: 44, color: C.grayLight },
  starActive: { color: COLORS.accent },
  ratingLabel: { alignItems: 'center' },
  ratingLabelText: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  ratingLabelAm: { fontSize: 14, color: C.gray, marginTop: 2 },
  commentInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: C.text,
    minHeight: 90, backgroundColor: C.grayLighter,
  },
  charCount: { fontSize: 11, color: C.gray, textAlign: 'right', marginTop: 4 },
  quickLabel: { fontSize: 13, color: C.gray, marginBottom: 10 },
  quickTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.grayLighter, borderWidth: 1, borderColor: C.border,
  },
  tagActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tagText: { fontSize: 13, color: C.text, fontWeight: '500' },
  tagTextActive: { color: COLORS.white },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, padding: 18, alignItems: 'center', marginTop: 4,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.5, shadowOpacity: 0 },
  submitText: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  submitTextAm: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  skipBtn: { alignItems: 'center', paddingVertical: 14 },
  skipText: { color: C.gray, fontSize: 14 },
});
