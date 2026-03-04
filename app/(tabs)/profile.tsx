import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { authedRequest } from "@/lib/api";
import { Colors } from "@/constants/colors";

const AVATAR_COLORS = ["#FF6B9D", "#FF8E53"];

function ProfileCompleteness({ user }: { user: any }) {
  const fields = [
    !!user.bio,
    user.interests?.length > 0,
    !!user.location?.city,
    user.photos?.length > 0,
  ];
  const completed = fields.filter(Boolean).length;
  const percentage = Math.round((completed / fields.length) * 100);

  return (
    <View style={styles.completenessCard}>
      <View style={styles.completenessHeader}>
        <Text style={styles.completenessTitle}>Profile strength</Text>
        <Text style={styles.completenessPercent}>{percentage}%</Text>
      </View>
      <View style={styles.completenessBar}>
        <View style={[styles.completenessProgress, { width: `${percentage}%` as any }]} />
      </View>
      {percentage < 100 && (
        <Text style={styles.completenessTip}>
          Complete your profile to get more matches
        </Text>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, logout, refreshUser } = useAuth();
  const [cancelingPremium, setCancelingPremium] = useState(false);

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  async function handleCancelPremium() {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Cancel Premium",
        "Are you sure you want to cancel your premium subscription?",
        [
          { text: "No", style: "cancel" },
          {
            text: "Yes, Cancel",
            style: "destructive",
            onPress: async () => {
              setCancelingPremium(true);
              try {
                await authedRequest("POST", "/api/subscription/cancel", undefined, token);
                await refreshUser();
              } catch {}
              setCancelingPremium(false);
            },
          },
        ]
      );
    } else {
      setCancelingPremium(true);
      try {
        await authedRequest("POST", "/api/subscription/cancel", undefined, token);
        await refreshUser();
      } catch {}
      setCancelingPremium(false);
    }
  }

  function handleLogout() {
    if (Platform.OS !== "web") {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: logout },
      ]);
    } else {
      logout();
    }
  }

  if (!user) return null;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable
          style={styles.editBtn}
          onPress={() => router.push("/edit-profile")}
        >
          <Ionicons name="pencil" size={18} color={Colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
      >
        <View style={styles.profileHero}>
          <LinearGradient
            colors={AVATAR_COLORS as any}
            style={styles.avatar}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarText}>{initials}</Text>
          </LinearGradient>
          <View style={styles.heroInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{user.name}</Text>
              {user.isPremium && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={12} color="#fff" />
                  <Text style={styles.premiumBadgeText}>Premium</Text>
                </View>
              )}
            </View>
            <Text style={styles.profileAge}>{user.age} years old</Text>
            {user.location?.city && (
              <View style={styles.locationRow}>
                <Ionicons name="location" size={13} color={Colors.textMuted} />
                <Text style={styles.locationText}>
                  {user.location.city}, {user.location.country}
                </Text>
              </View>
            )}
          </View>
        </View>

        <ProfileCompleteness user={user} />

        {user.bio ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{user.bio}</Text>
          </View>
        ) : null}

        {user.interests?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsWrap}>
              {user.interests.map((interest: string) => (
                <View key={interest} style={styles.interestChip}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.prefCard}>
            <View style={styles.prefRow}>
              <Ionicons name="people" size={18} color={Colors.primary} />
              <Text style={styles.prefLabel}>Interested in</Text>
              <Text style={styles.prefValue}>
                {user.preferences?.genderPreference === "any" ? "Everyone" : user.preferences?.genderPreference || "Any"}
              </Text>
            </View>
            <View style={styles.prefDivider} />
            <View style={styles.prefRow}>
              <Ionicons name="calendar" size={18} color={Colors.primary} />
              <Text style={styles.prefLabel}>Age range</Text>
              <Text style={styles.prefValue}>
                {user.preferences?.ageRange?.min || 18} - {user.preferences?.ageRange?.max || 50}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>
          {user.isPremium ? (
            <View style={styles.premiumCard}>
              <LinearGradient
                colors={[Colors.premium, Colors.premiumDark]}
                style={styles.premiumCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.premiumCardContent}>
                  <View>
                    <Text style={styles.premiumCardTitle}>Premium Active</Text>
                    <Text style={styles.premiumCardSubtitle}>Unlimited swipes & messages</Text>
                  </View>
                  <Ionicons name="star" size={28} color="rgba(255,255,255,0.6)" />
                </View>
              </LinearGradient>
              <Pressable
                style={styles.cancelBtn}
                onPress={handleCancelPremium}
                disabled={cancelingPremium}
              >
                {cancelingPremium ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <Text style={styles.cancelBtnText}>Cancel subscription</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.upgradeCard, pressed && { opacity: 0.95 }]}
              onPress={() => router.push("/premium")}
            >
              <LinearGradient
                colors={[Colors.premium, Colors.premiumDark]}
                style={styles.upgradeCardGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.upgradeCardContent}>
                  <View>
                    <Text style={styles.upgradeCardTitle}>Go Premium</Text>
                    <Text style={styles.upgradeCardSubtitle}>
                      Unlimited swipes, see who liked you
                    </Text>
                  </View>
                  <View style={styles.upgradeArrow}>
                    <Ionicons name="arrow-forward" size={18} color={Colors.premiumDark} />
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        <View style={styles.section}>
          <Pressable
            style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/edit-profile")}
          >
            <Ionicons name="person-outline" size={20} color={Colors.text} />
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.8 }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
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
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFF0F2",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { paddingHorizontal: 20, gap: 16 },
  profileHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
    color: "rgba(255,255,255,0.85)",
  },
  heroInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  profileName: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.premium,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  premiumBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "#fff",
  },
  profileAge: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  locationText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textMuted,
  },
  completenessCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  completenessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  completenessTitle: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  completenessPercent: {
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    color: Colors.primary,
  },
  completenessBar: {
    height: 6,
    backgroundColor: "#F0F0F0",
    borderRadius: 3,
    overflow: "hidden",
  },
  completenessProgress: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  completenessTip: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  section: {},
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bioText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  interestsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestChip: {
    backgroundColor: "#FFF0F2",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#FFD6DC",
  },
  interestText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.primary,
  },
  prefCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  prefLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  prefValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.text,
    textTransform: "capitalize",
  },
  prefDivider: { height: 1, backgroundColor: "#F5F5F5", marginHorizontal: 16 },
  premiumCard: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: Colors.premium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  premiumCardGradient: { padding: 20 },
  premiumCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  premiumCardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
  },
  premiumCardSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  cancelBtn: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.error,
  },
  upgradeCard: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: Colors.premium,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  upgradeCardGradient: { padding: 20 },
  upgradeCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  upgradeCardTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
  },
  upgradeCardSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  upgradeArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItemText: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#FFE5E5",
    backgroundColor: "#FFF5F5",
  },
  logoutText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.error,
  },
});
