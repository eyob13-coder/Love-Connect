import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { authedRequest } from "@/lib/api";
import { Colors } from "@/constants/colors";

const AVATAR_COLORS = [
  ["#FF6B9D", "#FF8E53"],
  ["#667EEA", "#764BA2"],
  ["#11998E", "#38EF7D"],
  ["#FC466B", "#3F5EFB"],
  ["#F093FB", "#F5576C"],
  ["#4FACFE", "#00F2FE"],
  ["#43E97B", "#38F9D7"],
  ["#FA709A", "#FEE140"],
];

interface ConversationItem {
  match: { id: string; createdAt: string };
  user: { id: string; name: string; age: number; bio: string };
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function ConversationItem({ item, index }: { item: ConversationItem; index: number }) {
  const { user: authUser } = useAuth();
  const colors = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = item.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const hasUnread = item.unreadCount > 0;
  const isMyMessage = item.lastMessage?.senderId === authUser?.id;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.conversationItem,
        hasUnread && styles.conversationItemUnread,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
      onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.match.id, name: item.user.name } })}
    >
      <View style={styles.avatarContainer}>
        <LinearGradient
          colors={colors as any}
          style={styles.avatar}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
        {hasUnread && <View style={styles.onlineDot} />}
      </View>

      <View style={styles.convInfo}>
        <View style={styles.convHeader}>
          <Text style={[styles.convName, hasUnread && styles.convNameUnread]}>
            {item.user.name}
          </Text>
          <Text style={styles.convTime}>
            {item.lastMessage
              ? timeAgo(item.lastMessage.createdAt)
              : timeAgo(item.match.createdAt)}
          </Text>
        </View>
        <Text
          style={[styles.convPreview, hasUnread && styles.convPreviewUnread]}
          numberOfLines={1}
        >
          {item.lastMessage
            ? `${isMyMessage ? "You: " : ""}${item.lastMessage.content}`
            : "Matched! Say hello"}
        </Text>
      </View>

      {hasUnread ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      )}
    </Pressable>
  );
}

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadConversations() {
    try {
      const res = await authedRequest("GET", "/api/matches", undefined, token);
      const data = await res.json();
      const withMessages = (data.matches || []).filter(
        (m: ConversationItem) => m.lastMessage !== null
      );
      setConversations(data.matches || []);
    } catch {}
  }

  useEffect(() => {
    loadConversations().finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          {totalUnread > 0 && (
            <Text style={styles.headerSubtitle}>{totalUnread} unread</Text>
          )}
        </View>
        {!user?.isPremium && (
          <Pressable
            style={styles.limitIndicator}
            onPress={() => router.push("/premium")}
          >
            <Ionicons name="chatbubble" size={13} color={Colors.primary} />
            <Text style={styles.limitText}>
              {Math.max(0, 5 - (user?.messagesUsedToday || 0))} msgs left today
            </Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.match.id}
          renderItem={({ item, index }) => <ConversationItem item={item} index={index} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 90 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubble-outline" size={44} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>
                Start a conversation with your matches
              </Text>
              <Pressable
                style={styles.matchesBtn}
                onPress={() => router.push("/(tabs)/matches")}
              >
                <Text style={styles.matchesBtnText}>View Matches</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.primary,
    marginTop: 2,
  },
  limitIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFF0F2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  limitText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: Colors.primary,
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  conversationItemUnread: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  avatarContainer: { position: "relative", marginRight: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "rgba(255,255,255,0.85)",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: "#fff",
  },
  convInfo: { flex: 1 },
  convHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  convName: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: Colors.text,
  },
  convNameUnread: { fontFamily: "Inter_700Bold" },
  convTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  convPreview: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  convPreviewUnread: {
    fontFamily: "Inter_500Medium",
    color: Colors.text,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  unreadText: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#FFF0F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.text,
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  matchesBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  matchesBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
});
