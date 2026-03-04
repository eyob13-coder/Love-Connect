import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  PanResponder,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { authedRequest } from "@/lib/api";
import { Colors } from "@/constants/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = SCREEN_HEIGHT * 0.62;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

interface Profile {
  id: string;
  name: string;
  age: number;
  bio: string;
  interests: string[];
  location: { city: string; country: string };
  photos: string[];
  isPremium: boolean;
}

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

function ProfileCard({
  profile,
  index,
  isTop,
  onSwipe,
}: {
  profile: Profile;
  index: number;
  isTop: boolean;
  onSwipe: (direction: "like" | "pass" | "superlike") => void;
}) {
  const position = useRef(new Animated.ValueXY()).current;
  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ["-12deg", "0deg", "12deg"],
    extrapolate: "clamp",
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SCREEN_WIDTH / 5],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const passOpacity = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 5, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const colorPair = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isTop,
      onMoveShouldSetPanResponder: () => isTop,
      onPanResponderMove: Animated.event(
        [null, { dx: position.x, dy: position.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: SCREEN_WIDTH + 100, y: gesture.dy },
            duration: 250,
            useNativeDriver: false,
          }).start(() => onSwipe("like"));
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH - 100, y: gesture.dy },
            duration: 250,
            useNativeDriver: false,
          }).start(() => onSwipe("pass"));
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 6,
          }).start();
        }
      },
    })
  ).current;

  const cardStyle = isTop
    ? {
        transform: [
          { translateX: position.x },
          { translateY: position.y },
          { rotate },
        ],
        zIndex: 10,
      }
    : {
        transform: [{ scale: 0.95 }, { translateY: 12 }],
        zIndex: 5,
      };

  return (
    <Animated.View
      style={[styles.card, cardStyle]}
      {...(isTop ? panResponder.panHandlers : {})}
    >
      <LinearGradient
        colors={colorPair as any}
        style={styles.cardAvatarBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.cardInitials}>{initials}</Text>
        {profile.isPremium && (
          <View style={styles.premiumBadge}>
            <Ionicons name="star" size={10} color="#fff" />
          </View>
        )}
      </LinearGradient>

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {isTop && (
        <>
          <Animated.View style={[styles.swipeLabel, styles.likeLabel, { opacity: likeOpacity }]}>
            <Text style={styles.likeLabelText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.swipeLabel, styles.passLabel, { opacity: passOpacity }]}>
            <Text style={styles.passLabelText}>PASS</Text>
          </Animated.View>
        </>
      )}

      <View style={styles.cardInfo}>
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName}>
            {profile.name}, {profile.age}
          </Text>
          {profile.location.city ? (
            <View style={styles.locationPill}>
              <Ionicons name="location" size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.locationText}>{profile.location.city}</Text>
            </View>
          ) : null}
        </View>
        {profile.bio ? (
          <Text style={styles.cardBio} numberOfLines={2}>
            {profile.bio}
          </Text>
        ) : null}
        {profile.interests.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.interestScroll}
          >
            {profile.interests.slice(0, 4).map((interest) => (
              <View key={interest} style={styles.interestChip}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Animated.View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, refreshUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchProfile, setMatchProfile] = useState<Profile | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const matchAnimation = useRef(new Animated.Value(0)).current;

  async function loadProfiles() {
    setLoading(true);
    try {
      const res = await authedRequest("GET", "/api/discover", undefined, token);
      const data = await res.json();
      setProfiles(data.profiles || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  const showMatch = useCallback((profile: Profile) => {
    setMatchProfile(profile);
    matchAnimation.setValue(0);
    Animated.spring(matchAnimation, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 6,
    }).start();
    setTimeout(() => {
      setMatchProfile(null);
    }, 2800);
  }, []);

  async function handleSwipe(direction: "like" | "pass" | "superlike") {
    if (profiles.length === 0) return;
    const [current, ...rest] = profiles;

    if (direction !== "pass") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const res = await authedRequest("POST", "/api/swipe", { targetId: current.id, direction }, token);
      const data = await res.json();
      if (data.isMatch) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showMatch(current);
      }
    } catch (err: any) {
      if (err.message?.includes("limit") || err.limitReached) {
        setLimitReached(true);
        return;
      }
    }

    setProfiles(rest);
    refreshUser();
  }

  function triggerSwipe(direction: "like" | "pass") {
    handleSwipe(direction);
  }

  const topProfile = profiles[0];
  const nextProfile = profiles[1];

  const swipesLeft = user
    ? user.isPremium
      ? "Unlimited"
      : Math.max(0, 10 - (user.swipesUsedToday || 0))
    : 0;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="flame" size={26} color={Colors.primary} />
          <Text style={styles.headerTitle}>Connectly</Text>
        </View>
        <View style={styles.headerRight}>
          {!user?.isPremium && (
            <Pressable style={styles.swipeCounter} onPress={() => router.push("/premium")}>
              <Ionicons name="flash" size={13} color={Colors.primary} />
              <Text style={styles.swipeCounterText}>{swipesLeft} left</Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.push("/premium")} style={styles.crownBtn}>
            <Ionicons name="star" size={20} color={user?.isPremium ? Colors.premium : Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <View style={styles.cardsArea}>
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : limitReached ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={["#FFF0F2", "#FFF5F5"]}
              style={styles.emptyCard}
            >
              <View style={styles.emptyIconBg}>
                <Ionicons name="flash" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Daily limit reached</Text>
              <Text style={styles.emptySubtitle}>
                Go Premium for unlimited swipes and see who liked you
              </Text>
              <Pressable
                style={styles.upgradeBtn}
                onPress={() => router.push("/premium")}
              >
                <LinearGradient
                  colors={[Colors.premium, Colors.premiumDark]}
                  style={styles.upgradeBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="star" size={16} color="#fff" />
                  <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
                </LinearGradient>
              </Pressable>
            </LinearGradient>
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <LinearGradient
              colors={["#FFF0F2", "#FFF5F5"]}
              style={styles.emptyCard}
            >
              <View style={styles.emptyIconBg}>
                <Ionicons name="heart-dislike" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>You've seen everyone</Text>
              <Text style={styles.emptySubtitle}>
                Check back later for new profiles in your area
              </Text>
              <Pressable style={styles.refreshBtn} onPress={loadProfiles}>
                <Text style={styles.refreshBtnText}>Refresh</Text>
              </Pressable>
            </LinearGradient>
          </View>
        ) : (
          <>
            {nextProfile && (
              <ProfileCard
                key={`next-${nextProfile.id}`}
                profile={nextProfile}
                index={1}
                isTop={false}
                onSwipe={() => {}}
              />
            )}
            {topProfile && (
              <ProfileCard
                key={`top-${topProfile.id}`}
                profile={topProfile}
                index={0}
                isTop={true}
                onSwipe={handleSwipe}
              />
            )}
          </>
        )}
      </View>

      {profiles.length > 0 && !loading && !limitReached && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + 80 }]}>
          <Pressable
            style={[styles.actionBtn, styles.passBtn]}
            onPress={() => triggerSwipe("pass")}
          >
            <Ionicons name="close" size={28} color={Colors.pass} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.superlikeBtn]}
            onPress={() => handleSwipe("superlike")}
          >
            <Ionicons name="star" size={22} color={Colors.superlike} />
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.likeBtn]}
            onPress={() => triggerSwipe("like")}
          >
            <Ionicons name="heart" size={28} color={Colors.like} />
          </Pressable>
        </View>
      )}

      {matchProfile && (
        <Animated.View
          style={[
            styles.matchOverlay,
            {
              opacity: matchAnimation,
              transform: [{ scale: matchAnimation }],
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(232,68,90,0.95)", "rgba(255,107,129,0.95)"]}
            style={styles.matchCard}
          >
            <Ionicons name="heart" size={60} color="#fff" />
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Text style={styles.matchSubtitle}>
              You and {matchProfile.name} liked each other
            </Text>
            <Pressable
              style={styles.matchChatBtn}
              onPress={() => {
                setMatchProfile(null);
                router.push("/(tabs)/matches");
              }}
            >
              <Text style={styles.matchChatBtnText}>Send a Message</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  swipeCounter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF0F2",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  swipeCounterText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.primary,
  },
  crownBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  cardsArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardAvatarBg: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
  },
  cardInitials: {
    fontFamily: "Inter_700Bold",
    fontSize: 100,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: -2,
  },
  premiumBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(245,158,11,0.9)",
    borderRadius: 12,
    padding: 6,
  },
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  swipeLabel: {
    position: "absolute",
    top: 50,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 4,
  },
  likeLabel: {
    left: 20,
    borderColor: Colors.like,
    backgroundColor: "rgba(74,222,128,0.15)",
  },
  passLabel: {
    right: 20,
    borderColor: Colors.pass,
    backgroundColor: "rgba(248,113,113,0.15)",
  },
  likeLabelText: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.like,
    letterSpacing: 2,
  },
  passLabelText: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.pass,
    letterSpacing: 2,
  },
  cardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    gap: 6,
  },
  cardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  cardName: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: "#fff",
    letterSpacing: -0.5,
  },
  locationPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  locationText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "rgba(255,255,255,0.9)",
  },
  cardBio: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
  },
  interestScroll: { marginTop: 4 },
  interestChip: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 6,
  },
  interestText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#fff",
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  passBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
  },
  superlikeBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
  },
  likeBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  emptyCard: {
    width: CARD_WIDTH,
    borderRadius: 28,
    padding: 36,
    alignItems: "center",
    gap: 12,
  },
  emptyIconBg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(232,68,90,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
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
  upgradeBtn: { marginTop: 8, borderRadius: 14, overflow: "hidden", width: "100%" },
  upgradeBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  upgradeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
  refreshBtn: {
    marginTop: 8,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  refreshBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.primary,
  },
  matchOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  matchCard: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 28,
    padding: 40,
    alignItems: "center",
    gap: 12,
  },
  matchTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 32,
    color: "#fff",
    letterSpacing: -1,
  },
  matchSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  matchChatBtn: {
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  matchChatBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#fff",
  },
});
