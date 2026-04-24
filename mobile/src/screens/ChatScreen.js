import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import api from '../services/api';
import { useSelector } from 'react-redux';
import { COLORS, SOCKET_URL } from '../utils/constants';
import { getColors } from '../utils/theme';
import { t } from '../utils/i18n';

export default function ChatScreen({ route }) {
  const { orderId, orderNumber } = route.params;
  const { user } = useSelector((s) => s.auth);
  const theme = useSelector((s) => s.settings.theme);
  const C = getColors(theme);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const socketRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    loadMessages();
    setupSocket();
    return () => socketRef.current?.disconnect();
  }, []);

  const loadMessages = async () => {
    try {
      const { data } = await api.get(`/chat/order/${orderId}`);
      setMessages(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const setupSocket = async () => {
    const token = await SecureStore.getItemAsync('accessToken');
    const socket = io(SOCKET_URL, { auth: { token } });
    socket.emit('join_order', orderId);
    socket.on('new_chat_message', (msg) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
    socketRef.current = socket;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setInput('');
    try {
      const { data } = await api.post(`/chat/order/${orderId}`, { message: text });
      setMessages((prev) => [...prev, data.data]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setInput(text);
    } finally {
      setIsSending(false);
    }
  };

  const styles = getStyles(C);

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === user.id;
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(item.sender?.fullName || 'D').charAt(0)}</Text>
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMe && <Text style={styles.senderName}>{item.sender?.fullName || 'Driver'}</Text>}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.message}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>
            {new Date(item.createdAt).toLocaleTimeString('en-ET', { hour: '2-digit', minute: '2-digit' })}
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
            <Text style={styles.emptyText}>{t('noMessages')}</Text>
          </View>
        }
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          placeholder={t('typeMessage')}
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
            ? <ActivityIndicator size="small" color={COLORS.white} />
            : <Text style={styles.sendBtnText}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (C) => StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background },
  orderBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  orderBadgeText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },
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
  bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: C.white, borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', color: COLORS.primaryLight, marginBottom: 2 },
  msgText: { fontSize: 15, color: C.text, lineHeight: 21 },
  msgTextMe: { color: COLORS.white },
  msgTime: { fontSize: 11, color: C.gray, marginTop: 4, alignSelf: 'flex-end' },
  msgTimeMe: { color: 'rgba(255,255,255,0.65)' },
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
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: COLORS.white, fontSize: 20, fontWeight: '700' },
});
