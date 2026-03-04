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

interface MatchItem {
  match: { id: string; createdAt: string };
  user: { id: string; name: string; age: number; bio: string; interests: string[] };
  lastMessage: { content: string; createdAt: string; senderId: string } | null;
  unreadCount: number;
}

function MatchCard({ item, index }: { item: MatchItem; index: number }) {
  const colors = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = item.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.matchCard, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
      onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.match.id, name: item.user.name } })}
    >
      <LinearGradient colors={colors as any} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={styles.avatarText}>{initials}</Text>
      </LinearGradient>
      <View style={styles.matchInfo}>
        <View style={styles.matchHeader}>
          <Text style={styles.matchName}>{item.user.name}</Text>
          {item.lastMessage && (
            <Text style={styles.matchTime}>{timeAgo(item.lastMessage.createdAt)}</Text>
          )}
        </View>
        <Text style={styles.matchPreview} numberOfLines={1}>
          {item.lastMessage ? item.lastMessage.content : item.user.bio || "Say hello!"}
        </Text>
      </View>
      {item.unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{item.unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

interface LikesData {
  count: number;
  profiles: Array<{ id: string; name: string; age: number }>;
}

export default function MatchesScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [likes, setLikes] = useState<LikesData>({ count: 0, profiles: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    try {
      const [matchRes, likeRes] = await Promise.all([
        authedRequest("GET", "/api/matches", undefined, token),
        authedRequest("GET", "/api/likes", undefined, token),
      ]);
      const matchData = await matchRes.json();
      const likeData = await likeRes.json();
      setMatches(matchData.matches || []);
      setLikes(likeData);
    } catch {}
  }

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
        <Text style={styles.headerSubtitle}>
          {matches.length} {matches.length === 1 ? "match" : "matches"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.match.id}
          renderItem={({ item, index }) => <MatchCard item={item} index={index} />}
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
          ListHeaderComponent={
            <View>
              <Pressable
                style={({ pressed }) => [styles.likesCard, pressed && { opacity: 0.95 }]}
                onPress={() => !user?.isPremium && router.push("/premium")}
              >
                <LinearGradient
                  colors={[Colors.premium, Colors.premiumDark]}
                  style={styles.likesGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.likesContent}>
                    <View>
                      <Text style={styles.likesCount}>{likes.count}</Text>
                      <Text style={styles.likesLabel}>people liked you</Text>
                    </View>
                    {!user?.isPremium ? (
                      <View style={styles.lockBadge}>
                        <Ionicons name="lock-closed" size={16} color={Colors.premiumDark} />
                        <Text style={styles.lockText}>Premium</Text>
                      </View>
                    ) : (
                      <Ionicons name="heart" size={32} color="rgba(255,255,255,0.5)" />
                    )}
                  </View>
                  {!user?.isPremium && (
                    <Text style={styles.likesHint}>Upgrade to see who liked you</Text>
                  )}
                </LinearGradient>
              </Pressable>

              {matches.length > 0 && (
                <Text style={styles.sectionTitle}>Your Matches</Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="heart-outline" size={44} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Text style={styles.emptySubtitle}>
                Keep swiping! Your matches will appear here
              </Text>
              <Pressable
                style={styles.discoverBtn}
                onPress={() => router.push("/(tabs)")}
              >
                <Text style={styles.discoverBtnText}>Start Discovering</Text>
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
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 20 },
  likesCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: Colors.premium,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  likesGradient: { padding: 20 },
  likesContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  likesCount: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: "#fff",
    letterSpacing: -1,
  },
  likesLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  lockText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.premiumDark,
  },
  likesHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 10,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
  },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "rgba(255,255,255,0.85)",
  },
  matchInfo: { flex: 1 },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  matchName: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.text,
  },
  matchTime: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
  },
  matchPreview: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
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
    paddingVertical: 40,
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
    textAlign: "center",
  },
  emptySubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  discoverBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  discoverBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
});
