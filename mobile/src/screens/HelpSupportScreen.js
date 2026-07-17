import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Linking,
} from 'react-native';
import { useSelector } from 'react-redux';
import { COLORS } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t } from '../utils/i18n';

const FAQ = [
  {
    q: 'How do I go online and start receiving orders?',
    qAm: 'እንዴት ኦንላይን ሆኜ ትዕዛዞችን እቀበላለሁ?',
    a: 'Go to the Home screen and tap the green "Go Online" button. Make sure your location is enabled.',
    aAm: 'ወደ ዋናው ገጽ ሄደው አረንጓዴ "ኦንላይን ሁን" ቁልፍ ይጫኑ። መቼም ቦታዎ ነቅቷል ያረጋግጡ።',
  },
  {
    q: 'When do I get paid for deliveries?',
    qAm: 'ለማድረስ ስራ መቼ ክፍያ እቀበላለሁ?',
    a: 'Earnings are added to your wallet after each completed delivery. You can withdraw any time from the Wallet screen.',
    aAm: 'ገቢ ከእያንዳንዱ ማድረስ በኋላ ወደ ቦርሳዎ ይጨምሩ። ከቦርሳ ገጽ ማንኛውም ጊዜ ማውጣት ይችላሉ።',
  },
  {
    q: 'My account is suspended. What do I do?',
    qAm: 'መለያዬ ታግዷል። ምን ማድረግ አለብኝ?',
    a: 'Contact our support team at +251 11 555 0000 or email support@etspark.et for account review.',
    aAm: 'ለድጋፍ ቡድናችን +251 11 555 0000 ይደውሉ ወይም support@etspark.et ኢሜይል ይላኩ።',
  },
  {
    q: 'How is my fare calculated?',
    qAm: 'ዋጋዬ እንዴት ይሰላል?',
    a: 'Base fee: ETB 50 + ETB 15/km. Surge pricing may apply during peak hours (7–9 AM, 12–2 PM, 5–8 PM).',
    aAm: 'መሠረታዊ ክፍያ: 50 ብር + 15 ብር/ኪሜ። ከፍተኛ ሰዓቶች ላይ (7–9 ጠ.ቀ., 12–2 ምሳ, 5–8 ማ.ሆ.) ተጨማሪ ሊጨምር ይችላል።',
  },
  {
    q: 'How do I update my vehicle or license information?',
    qAm: 'ተሽከርካሪዬን ወይም ፍቃዴን እንዴት አዘምናለሁ?',
    a: 'Go to Profile → Edit Profile. For document updates, contact support.',
    aAm: 'ወደ መገለጫ → መገለጫ አርትዕ ሂዱ። ለሰነድ ማዘምን፣ ድጋፍ ያናጋሩ።',
  },
  {
    q: 'The app is not showing nearby orders.',
    qAm: 'አፕ ሊካናቸው ያሉ ትዕዛዞችን አያሳይም።',
    a: 'Make sure you are Online, GPS is enabled, and the app has location permissions. Try restarting the app.',
    aAm: 'ኦንላይን መሆንዎን፣ GPS ነቃ መሆኑን እና አፕ ቦታ ፍቃድ እንዳለው ያረጋግጡ። አፕን እንደገና ለመጀመር ይሞክሩ።',
  },
];

const CONTACT = [
  { icon: '📞', labelKey: 'callSupport', subLabel: '+251 11 555 0000', action: 'tel:+251115550000' },
  { icon: '💬', label: 'WhatsApp', subLabel: '+251 91 555 0001', action: 'https://wa.me/251915550001' },
  { icon: '📧', labelKey: 'emailLabel', subLabel: 'support@etspark.et', action: 'mailto:support@etspark.et' },
  { icon: '🌐', labelKey: 'website', subLabel: 'etspark.et', action: 'https://etspark.et' },
];

export default function HelpSupportScreen() {
  const theme = useSelector((s) => s.settings.theme);
  const language = useSelector((s) => s.settings.language);
  const C = getColors(theme);
  const [expanded, setExpanded] = useState(null);
  const styles = getStyles(C);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('helpSupport', language)}</Text>
        <Text style={styles.headerSubtitle}>{t('helpSubtitle', language)}</Text>
      </View>

      {/* Contact options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('contactUs', language)}</Text>
        <View style={styles.contactGrid}>
          {CONTACT.map((item) => (
            <TouchableOpacity
              key={item.labelKey || item.label}
              style={styles.contactCard}
              onPress={() => Linking.openURL(item.action)}
              activeOpacity={0.7}
            >
              <Text style={styles.contactIcon}>{item.icon}</Text>
              <Text style={styles.contactLabel}>{item.labelKey ? t(item.labelKey, language) : item.label}</Text>
              <Text style={styles.contactSub}>{item.subLabel}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* FAQ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('faq', language)}</Text>
        {FAQ.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqItem}
            onPress={() => setExpanded(expanded === index ? null : index)}
            activeOpacity={0.7}
          >
            <View style={styles.faqHeader}>
              <View style={styles.faqQuestion}>
                <Text style={styles.faqQ}>{language === 'am' ? item.qAm : item.q}</Text>
              </View>
              <Text style={[styles.faqChevron, expanded === index && styles.faqChevronOpen]}>›</Text>
            </View>
            {expanded === index && (
              <View style={styles.faqAnswer}>
                <Text style={styles.faqA}>{language === 'am' ? item.aAm : item.a}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* App version */}
      <View style={styles.versionRow}>
        <Text style={styles.versionText}>Fetno v1.0.0</Text>
        <Text style={styles.versionSub}>{t('madeWithLoveEthiopia', language)}</Text>
      </View>
    </ScrollView>
  );
}

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { backgroundColor: COLORS.accent, padding: 24, paddingTop: 32 },
  headerTitle: { color: COLORS.primary, fontSize: 24, fontWeight: '800' },
  headerSubtitle: { color: 'rgba(27,67,50,0.75)', fontSize: 13, marginTop: 10, lineHeight: 20 },
  section: { padding: 16, paddingBottom: 0 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 12 },
  contactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  contactCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: C.white, borderRadius: 14, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  contactIcon: { fontSize: 28, marginBottom: 8 },
  contactLabel: { fontSize: 13, fontWeight: '700', color: C.text },
  contactSub: { fontSize: 11, color: C.gray, marginTop: 3, textAlign: 'center' },
  faqItem: {
    backgroundColor: C.white, borderRadius: 12, marginBottom: 8, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  faqHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 8 },
  faqQuestion: { flex: 1 },
  faqQ: { fontSize: 14, fontWeight: '600', color: C.text },
  faqChevron: { fontSize: 22, color: C.gray, fontWeight: '300' },
  faqChevronOpen: { transform: [{ rotate: '90deg' }] },
  faqAnswer: {
    paddingHorizontal: 14, paddingBottom: 14,
    borderTopWidth: 1, borderTopColor: C.grayLight, paddingTop: 12,
  },
  faqA: { fontSize: 13, color: C.text, lineHeight: 20 },
  versionRow: { alignItems: 'center', paddingTop: 24, paddingBottom: 8 },
  versionText: { fontSize: 12, color: C.gray },
  versionSub: { fontSize: 12, color: C.gray, marginTop: 4 },
});
