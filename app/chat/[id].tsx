import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { authedRequest } from "@/lib/api";
import { Colors } from "@/constants/colors";

interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

const AVATAR_COLORS = ["#667EEA", "#764BA2"];

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, "0");
  return `${h}:${m} ${ampm}`;
}

function MessageBubble({ message, isMe }: { message: Message; isMe: boolean }) {
  return (
    <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
      {isMe ? (
        <LinearGradient
          colors={[Colors.primaryLight, Colors.primary]}
          style={[styles.bubble, styles.bubbleMe]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.bubbleTextMe}>{message.content}</Text>
          <Text style={styles.bubbleTimeMe}>{formatTime(message.createdAt)}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.bubble, styles.bubbleThem]}>
          <Text style={styles.bubbleTextThem}>{message.content}</Text>
          <Text style={styles.bubbleTimeThem}>{formatTime(message.createdAt)}</Text>
        </View>
      )}
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow]}>
      <View style={[styles.bubble, styles.bubbleThem, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);

  async function loadMessages() {
    try {
      const res = await authedRequest("GET", `/api/messages/${id}`, undefined, token);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {}
  }

  useEffect(() => {
    loadMessages().finally(() => setLoading(false));
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [id]);

  async function sendMessage() {
    if (!text.trim() || sending || limitReached) return;
    const content = text.trim();
    setText("");
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      matchId: id,
      senderId: user?.id || "",
      content,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await authedRequest("POST", `/api/messages/${id}`, { content }, token);
      const data = await res.json();
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticMsg.id),
        data.message,
      ]);
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      if (err.message?.includes("limit") || err.limitReached) {
        setLimitReached(true);
      }
    } finally {
      setSending(false);
    }
  }

  function handleTextChange(val: string) {
    setText(val);
    if (!isTyping) setIsTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setIsTyping(false), 1500);
  }

  const chatName = name || "Chat";
  const initials = chatName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryLight]}
        style={[styles.chatHeader, { paddingTop: Platform.OS === "web" ? 0 : insets.top + 8 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <LinearGradient
          colors={AVATAR_COLORS as any}
          style={styles.headerAvatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.headerAvatarText}>{initials}</Text>
        </LinearGradient>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{chatName}</Text>
          <Text style={styles.headerStatus}>Active now</Text>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} isMe={item.senderId === user?.id} />
            )}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <LinearGradient
                  colors={AVATAR_COLORS as any}
                  style={styles.emptyChatAvatar}
                >
                  <Text style={styles.emptyChatInitials}>{initials}</Text>
                </LinearGradient>
                <Text style={styles.emptyChatName}>{chatName}</Text>
                <Text style={styles.emptyChatHint}>Send the first message!</Text>
              </View>
            }
            ListFooterComponent={isTyping && messages.length > 0 ? <TypingIndicator /> : null}
          />
        )}

        {limitReached && (
          <Pressable
            style={styles.limitBanner}
            onPress={() => router.push("/premium")}
          >
            <Ionicons name="lock-closed" size={14} color={Colors.premiumDark} />
            <Text style={styles.limitBannerText}>
              Message limit reached — Upgrade for unlimited messaging
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.premiumDark} />
          </Pressable>
        )}

        <View
          style={[
            styles.inputBar,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 8 },
          ]}
        >
          <TextInput
            style={styles.textInput}
            value={text}
            onChangeText={handleTextChange}
            placeholder={limitReached ? "Upgrade to send more messages..." : "Type a message..."}
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            editable={!limitReached}
          />
          <Pressable
            style={[
              styles.sendBtn,
              (!text.trim() || sending || limitReached) && styles.sendBtnDisabled,
            ]}
            onPress={sendMessage}
            disabled={!text.trim() || sending || limitReached}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
  },
  headerInfo: { flex: 1 },
  headerName: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#fff",
    letterSpacing: -0.3,
  },
  headerStatus: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: "row",
    marginVertical: 2,
  },
  bubbleRowMe: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  bubbleTextMe: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "#fff",
    lineHeight: 21,
  },
  bubbleTimeMe: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: "rgba(255,255,255,0.7)",
    alignSelf: "flex-end",
  },
  bubbleTextThem: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
  },
  bubbleTimeThem: {
    fontFamily: "Inter_400Regular",
    fontSize: 10,
    color: Colors.textMuted,
    alignSelf: "flex-end",
  },
  typingBubble: { paddingHorizontal: 16, paddingVertical: 14 },
  typingDots: { flexDirection: "row", gap: 4, alignItems: "center" },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.textMuted,
  },
  dot1: {},
  dot2: { opacity: 0.7 },
  dot3: { opacity: 0.4 },
  limitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  limitBannerText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.premiumDark,
    flex: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  textInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    backgroundColor: "#F5F5F5",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#E5E7EB" },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyChatAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyChatInitials: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: "rgba(255,255,255,0.85)",
  },
  emptyChatName: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  emptyChatHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
