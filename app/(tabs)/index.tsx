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
  Image,
  Modal,
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
  gender: string;
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

function HowMatchingWorksModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const STEPS = [
    {
      icon: "flame" as const,
      color: Colors.primary,
      title: "Browse Profiles",
      desc: "You see profiles of people near you who match your preferences.",
    },
    {
      icon: "heart" as const,
      color: Colors.like,
      title: "Swipe Right to Like",
      desc: "Swipe right or tap the heart if you're interested in someone.",
    },
    {
      icon: "close-circle" as const,
      color: Colors.pass,
      title: "Swipe Left to Pass",
      desc: "Not interested? Swipe left to see the next profile.",
    },
    {
      icon: "star" as const,
      color: Colors.superlike,
      title: "Super Like",
      desc: "Tap the star to super like — they'll know you really like them.",
    },
    {
      icon: "heart-circle" as const,
      color: Colors.primary,
      title: "It's a Match!",
      desc: "When two people both like each other, it's a match! You can then start chatting.",
    },
    {
      icon: "chatbubbles" as const,
      color: Colors.primary,
      title: "Start Chatting",
      desc: "Only matches can message each other — no unwanted messages.",
    },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={hwStyles.container}>
        <View style={hwStyles.header}>
          <Text style={hwStyles.title}>How Matching Works</Text>
          <Pressable style={hwStyles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={Colors.text} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={hwStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <LinearGradient
            colors={["#FFF0F2", "#FFF5F5"]}
            style={hwStyles.heroBanner}
          >
            <Ionicons name="heart-circle" size={56} color={Colors.primary} />
            <Text style={hwStyles.heroText}>Real connections start with a mutual interest</Text>
          </LinearGradient>

          {STEPS.map((step, i) => (
            <View key={i} style={hwStyles.step}>
              <View style={[hwStyles.stepIcon, { backgroundColor: step.color + "18" }]}>
                <Ionicons name={step.icon} size={22} color={step.color} />
              </View>
              <View style={hwStyles.stepInfo}>
                <Text style={hwStyles.stepTitle}>{step.title}</Text>
                <Text style={hwStyles.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}

          <View style={hwStyles.freeVsPremium}>
            <Text style={hwStyles.fvpTitle}>Free vs Premium</Text>
            <View style={hwStyles.fvpRow}>
              <Ionicons name="flash-outline" size={16} color={Colors.textMuted} />
              <Text style={hwStyles.fvpText}>Free: 10 swipes per day</Text>
            </View>
            <View style={hwStyles.fvpRow}>
              <Ionicons name="flash" size={16} color={Colors.premium} />
              <Text style={hwStyles.fvpText}>Premium: Unlimited swipes + see who liked you</Text>
            </View>
            <View style={hwStyles.fvpRow}>
              <Ionicons name="chatbubble-outline" size={16} color={Colors.textMuted} />
              <Text style={hwStyles.fvpText}>Free: 5 messages per day per match</Text>
            </View>
            <View style={hwStyles.fvpRow}>
              <Ionicons name="chatbubble" size={16} color={Colors.premium} />
              <Text style={hwStyles.fvpText}>Premium: Unlimited messaging</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const hwStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 20, color: Colors.text },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { padding: 20, gap: 16 },
  heroBanner: {
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  heroText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.text,
    textAlign: "center",
    lineHeight: 22,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepInfo: { flex: 1 },
  stepTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: Colors.text, marginBottom: 3 },
  stepDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  freeVsPremium: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  fvpTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.text,
    marginBottom: 4,
  },
  fvpRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fvpText: { fontFamily: "Inter_400Regular", fontSize: 13, color: Colors.textSecondary, flex: 1 },
});

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
  const hasPhoto = profile.photos && profile.photos.length > 0;

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
      {hasPhoto ? (
        <Image
          source={{ uri: profile.photos[0] }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={colorPair as any}
          style={styles.cardAvatarBg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.cardInitials}>{initials}</Text>
        </LinearGradient>
      )}

      {profile.isPremium && (
        <View style={styles.premiumBadge}>
          <Ionicons name="star" size={10} color="#fff" />
        </View>
      )}

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
          {profile.gender ? (
            <View style={styles.genderPill}>
              <Ionicons
                name={profile.gender === "female" ? "woman" : "man"}
                size={11}
                color="rgba(255,255,255,0.9)"
              />
            </View>
          ) : null}
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
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const matchAnimation = useRef(new Animated.Value(0)).current;

  async function loadProfiles() {
    setLoading(true);
    try {
      const res = await authedRequest("GET", "/api/discover", undefined, token);
      const data = await res.json();
      setProfiles(data.profiles || []);
      setLimitReached(false);
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
    }, 3000);
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

  const topProfile = profiles[0];
  const nextProfile = profiles[1];

  const swipesLeft = user
    ? user.isPremium
      ? null
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
          {!user?.isPremium && swipesLeft !== null && (
            <Pressable style={styles.swipeCounter} onPress={() => router.push("/premium")}>
              <Ionicons name="flash" size={13} color={Colors.primary} />
              <Text style={styles.swipeCounterText}>{swipesLeft} left</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setShowHowItWorks(true)}
            style={styles.infoBtn}
          >
            <Ionicons name="information-circle-outline" size={22} color={Colors.textSecondary} />
          </Pressable>
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
            <LinearGradient colors={["#FFF0F2", "#FFF5F5"]} style={styles.emptyCard}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="flash" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Daily limit reached</Text>
              <Text style={styles.emptySubtitle}>
                Go Premium for unlimited swipes and see who liked you
              </Text>
              <Pressable style={styles.upgradeBtn} onPress={() => router.push("/premium")}>
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
            <LinearGradient colors={["#FFF0F2", "#FFF5F5"]} style={styles.emptyCard}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="heart-dislike" size={40} color={Colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>You've seen everyone</Text>
              <Text style={styles.emptySubtitle}>
                Check back later for new profiles
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
            onPress={() => handleSwipe("pass")}
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
            onPress={() => handleSwipe("like")}
          >
            <Ionicons name="heart" size={28} color={Colors.like} />
          </Pressable>
        </View>
      )}

      {!!matchProfile && (
        <Animated.View
          style={[
            styles.matchOverlay,
            {
              opacity: matchAnimation,
              transform: [{ scale: matchAnimation }],
            },
          ]}
          pointerEvents="box-none"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMatchProfile(null)} />
          <LinearGradient
            colors={["rgba(232,68,90,0.97)", "rgba(255,107,129,0.97)"]}
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
              <Text style={styles.matchChatBtnText}>Go to Matches</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      )}

      <HowMatchingWorksModal
        visible={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
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
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  crownBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    backgroundColor: "#f0f0f0",
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
    zIndex: 2,
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
    zIndex: 3,
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
  genderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
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
    gap: 8,
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
