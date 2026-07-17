import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { useSelector } from 'react-redux';
import { COLORS } from '../utils/constants';
import { getColors } from '../utils/theme';
import { db } from '../services/firebase';
import { t } from '../utils/i18n';

export default function ChatScreen({ route }) {
  const { orderId, orderNumber } = route.params;
  const { user } = useSelector((s) => s.auth);
  const theme = useSelector((s) => s.settings.theme);
  const language = useSelector((s) => s.settings.language);
  const C = getColors(theme);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, 'orders', orderId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, createdAt: data.createdAt?.toDate?.() || new Date() };
      });
      setMessages(msgs);
      setIsLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }, (err) => {
      console.error('[Chat listener]', err.message);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [orderId]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setInput('');
    try {
      await addDoc(collection(db, 'orders', orderId, 'messages'), {
        senderId: user.uid,
        senderName: user.fullName || 'Driver',
        message: text,
        createdAt: serverTimestamp(),
      });
    } catch {
      setInput(text);
    } finally {
      setIsSending(false);
    }
  };

  const styles = getStyles(C);

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === user.uid;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.senderName || 'D').charAt(0)}</Text>
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMe && <Text style={styles.senderName}>{item.senderName || 'Driver'}</Text>}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.message}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {item.createdAt.toLocaleTimeString('en-ET', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.orderBadge}>
        <Text style={styles.orderBadgeText}>Order #{orderNumber}</Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyText}>{t('noMessages', language)}</Text>
          </View>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder={t('typeMessage', language)}
          placeholderTextColor={C.gray}
          multiline
          maxLength={500}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || isSending}
        >
          {isSending
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Text style={styles.sendBtnText}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
  orderBadge: { backgroundColor: COLORS.accent, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  orderBadgeText: { color: 'rgba(27,67,50,0.8)', fontSize: 13, fontWeight: '600' },
  messageList: { padding: 16, paddingBottom: 8 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: C.gray, marginTop: 12, fontSize: 15 },
  msgRow: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowThem: { justifyContent: 'flex-start' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  avatarText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  bubble: {
    maxWidth: '75%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2, elevation: 1,
  },
  bubbleMe: { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: C.white, borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', color: COLORS.primaryLight, marginBottom: 2 },
  msgText: { fontSize: 15, color: C.text, lineHeight: 21 },
  msgTextMe: { color: COLORS.primary },
  msgTime: { fontSize: 11, color: C.gray, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMe: { color: 'rgba(27,67,50,0.65)' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: 12, backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.grayLight, gap: 8,
  },
  textInput: {
    flex: 1, backgroundColor: C.grayLighter,
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: C.text, maxHeight: 100,
    borderWidth: 1, borderColor: C.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: COLORS.primary, fontSize: 20, fontWeight: '700' },
});
