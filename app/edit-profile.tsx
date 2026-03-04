import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { authedRequest } from "@/lib/api";
import { Colors } from "@/constants/colors";

const POPULAR_INTERESTS = [
  "Travel", "Music", "Fitness", "Cooking", "Reading",
  "Photography", "Hiking", "Coffee", "Movies", "Art",
  "Dancing", "Gaming", "Yoga", "Wine", "Nature",
  "Running", "Cycling", "Surfing", "Fashion", "Animals",
];

const GENDER_PREFS = ["male", "female", "non-binary", "any"];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, updateUser, refreshUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || "");
  const [city, setCity] = useState(user?.location?.city || "");
  const [country, setCountry] = useState(user?.location?.country || "");
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [minAge, setMinAge] = useState(String(user?.preferences?.ageRange?.min || 18));
  const [maxAge, setMaxAge] = useState(String(user?.preferences?.ageRange?.max || 50));
  const [genderPref, setGenderPref] = useState(user?.preferences?.genderPreference || "any");
  const [saving, setSaving] = useState(false);

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updates = {
        bio,
        interests,
        location: { city, country },
        preferences: {
          ageRange: {
            min: parseInt(minAge) || 18,
            max: parseInt(maxAge) || 50,
          },
          genderPreference: genderPref,
        },
      };
      const res = await authedRequest("PUT", "/api/profile", updates, token);
      const data = await res.json();
      updateUser(data.user);
      router.back();
    } catch (err: any) {
      if (Platform.OS !== "web") {
        Alert.alert("Error", err.message || "Failed to save profile");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={22} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About Me</Text>
          <TextInput
            style={styles.bioInput}
            value={bio}
            onChangeText={setBio}
            placeholder="Write a short bio about yourself..."
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={4}
            maxLength={300}
          />
          <Text style={styles.charCount}>{bio.length}/300</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>City</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="business-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Your city"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Country</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="earth-outline" size={16} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={country}
                onChangeText={setCountry}
                placeholder="Your country"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <Text style={styles.sectionSubtitle}>Select up to 8 interests</Text>
          <View style={styles.interestsGrid}>
            {POPULAR_INTERESTS.map((interest) => {
              const selected = interests.includes(interest);
              const disabled = !selected && interests.length >= 8;
              return (
                <Pressable
                  key={interest}
                  style={[
                    styles.interestChip,
                    selected && styles.interestChipSelected,
                    disabled && styles.interestChipDisabled,
                  ]}
                  onPress={() => !disabled && toggleInterest(interest)}
                >
                  <Text
                    style={[
                      styles.interestText,
                      selected && styles.interestTextSelected,
                      disabled && styles.interestTextDisabled,
                    ]}
                  >
                    {interest}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Preferences</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Interested in</Text>
            <View style={styles.genderPrefRow}>
              {GENDER_PREFS.map((g) => (
                <Pressable
                  key={g}
                  style={[
                    styles.genderPrefBtn,
                    genderPref === g && styles.genderPrefBtnActive,
                  ]}
                  onPress={() => setGenderPref(g)}
                >
                  <Text
                    style={[
                      styles.genderPrefText,
                      genderPref === g && styles.genderPrefTextActive,
                    ]}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.ageRangeRow}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Min Age</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={minAge}
                  onChangeText={setMinAge}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="18"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
            <View style={styles.ageDash} />
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Max Age</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={maxAge}
                  onChangeText={setMaxAge}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="50"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: Colors.text,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  scrollContent: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },
  section: { gap: 12 },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: -8,
  },
  bioInput: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "right",
    marginTop: -8,
  },
  inputGroup: { gap: 6 },
  inputLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: Colors.text,
  },
  interestsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  interestChipSelected: {
    backgroundColor: "#FFF0F2",
    borderColor: Colors.primary,
  },
  interestChipDisabled: {
    opacity: 0.4,
  },
  interestText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  interestTextSelected: { color: Colors.primary },
  interestTextDisabled: {},
  genderPrefRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderPrefBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  genderPrefBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: "#FFF0F2",
  },
  genderPrefText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  genderPrefTextActive: { color: Colors.primary },
  ageRangeRow: { flexDirection: "row", alignItems: "flex-end", gap: 0 },
  ageDash: {
    width: 20,
    height: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 24,
    marginHorizontal: 8,
  },
});
