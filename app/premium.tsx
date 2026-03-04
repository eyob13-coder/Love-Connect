import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { authedRequest } from "@/lib/api";
import { Colors } from "@/constants/colors";

const FEATURES = [
  {
    icon: "flash" as const,
    title: "Unlimited Swipes",
    description: "Swipe as much as you want, every day",
    free: "10/day",
    premium: "Unlimited",
  },
  {
    icon: "eye" as const,
    title: "See Who Liked You",
    description: "Know exactly who's interested in you",
    free: "Hidden",
    premium: "Visible",
  },
  {
    icon: "chatbubbles" as const,
    title: "Unlimited Messaging",
    description: "Chat as much as you like",
    free: "5/day",
    premium: "Unlimited",
  },
  {
    icon: "star" as const,
    title: "Premium Badge",
    description: "Stand out with a Premium profile badge",
    free: false,
    premium: true,
  },
];

export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await authedRequest("POST", "/api/subscription/upgrade", undefined, token);
      await refreshUser();
      setSuccess(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => router.back(), 1800);
    } catch {}
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.premium + "22", "#FFFFFF"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
      />

      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 }]}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.heroSection}>
          <View style={styles.crownContainer}>
            <LinearGradient
              colors={[Colors.premium, Colors.premiumDark]}
              style={styles.crownBg}
            >
              <Ionicons name="star" size={40} color="#fff" />
            </LinearGradient>
          </View>
          <Text style={styles.heroTitle}>Connectly Premium</Text>
          <Text style={styles.heroSubtitle}>
            Unlock your full potential and find your perfect match faster
          </Text>
        </View>

        <View style={styles.featuresCard}>
          <View style={styles.tableHeader}>
            <View style={{ flex: 1 }} />
            <Text style={styles.tableHeaderFree}>Free</Text>
            <Text style={styles.tableHeaderPremium}>Premium</Text>
          </View>

          {FEATURES.map((feature, index) => (
            <View key={feature.title}>
              <View style={styles.featureRow}>
                <View style={styles.featureLeft}>
                  <View style={styles.featureIconBg}>
                    <Ionicons name={feature.icon} size={16} color={Colors.premium} />
                  </View>
                  <View>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDesc}>{feature.description}</Text>
                  </View>
                </View>
                <Text style={styles.freeValue}>
                  {typeof feature.free === "boolean"
                    ? feature.free ? "Yes" : "No"
                    : feature.free}
                </Text>
                <View style={styles.premiumValue}>
                  {typeof feature.premium === "boolean" ? (
                    feature.premium ? (
                      <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    ) : (
                      <Ionicons name="close-circle" size={20} color={Colors.error} />
                    )
                  ) : (
                    <Text style={styles.premiumValueText}>{feature.premium}</Text>
                  )}
                </View>
              </View>
              {index < FEATURES.length - 1 && <View style={styles.featureDivider} />}
            </View>
          ))}
        </View>

        <View style={styles.pricingSection}>
          <View style={styles.pricingCard}>
            <LinearGradient
              colors={[Colors.premium, Colors.premiumDark]}
              style={styles.pricingGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.pricingContent}>
                <View>
                  <Text style={styles.pricingPlan}>Monthly Plan</Text>
                  <Text style={styles.pricingDesc}>Cancel anytime</Text>
                </View>
                <View style={styles.priceTag}>
                  <Text style={styles.priceCurrency}>$</Text>
                  <Text style={styles.priceAmount}>9</Text>
                  <Text style={styles.pricePeriod}>.99/mo</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {user?.isPremium ? (
          <View style={styles.alreadyPremium}>
            <Ionicons name="checkmark-circle" size={28} color={Colors.success} />
            <Text style={styles.alreadyPremiumText}>You're already Premium!</Text>
          </View>
        ) : success ? (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={40} color={Colors.success} />
            <Text style={styles.successText}>Welcome to Premium!</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.92 }]}
            onPress={handleUpgrade}
            disabled={loading}
          >
            <LinearGradient
              colors={[Colors.premium, Colors.premiumDark]}
              style={styles.upgradeBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="star" size={18} color="#fff" />
                  <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        )}

        <Text style={styles.disclaimer}>
          By upgrading, you agree to our Terms of Service and Privacy Policy. Subscriptions automatically renew unless cancelled.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },
  header: { paddingHorizontal: 16, marginBottom: 4 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  scrollContent: { paddingHorizontal: 20, gap: 20 },
  heroSection: { alignItems: "center", gap: 12, paddingTop: 8 },
  crownContainer: {
    shadowColor: Colors.premium,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  crownBg: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  heroSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  featuresCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    alignItems: "center",
  },
  tableHeaderFree: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.textSecondary,
    width: 65,
    textAlign: "center",
  },
  tableHeaderPremium: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.premium,
    width: 75,
    textAlign: "center",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  featureLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.premium + "15",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.text,
  },
  featureDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  freeValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    width: 65,
    textAlign: "center",
  },
  premiumValue: {
    width: 75,
    alignItems: "center",
  },
  premiumValueText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    color: Colors.premium,
  },
  featureDivider: { height: 1, backgroundColor: "#F5F5F5", marginHorizontal: 16 },
  pricingSection: {},
  pricingCard: {
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: Colors.premium,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  pricingGradient: { padding: 20 },
  pricingContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pricingPlan: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
  },
  pricingDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  priceTag: { flexDirection: "row", alignItems: "flex-start" },
  priceCurrency: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: "#fff",
    marginTop: 4,
  },
  priceAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 40,
    color: "#fff",
    lineHeight: 44,
    letterSpacing: -1,
  },
  pricePeriod: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 26,
    marginLeft: 2,
  },
  upgradeBtn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.premium,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  upgradeBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  upgradeBtnText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: "#fff",
    letterSpacing: 0.3,
  },
  alreadyPremium: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
  },
  alreadyPremiumText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: Colors.success,
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 10,
  },
  successText: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: Colors.success,
  },
  disclaimer: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
});
