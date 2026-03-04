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
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { authedRequest } from "@/lib/api";
import { Colors } from "@/constants/colors";

const POPULAR_INTERESTS = [
  "Travel", "Music", "Fitness", "Cooking", "Reading",
  "Photography", "Hiking", "Coffee", "Movies", "Art",
  "Dancing", "Gaming", "Yoga", "Wine", "Nature",
  "Running", "Cycling", "Surfing", "Fashion", "Animals",
];

const GENDER_PREFS: Array<{ value: "male" | "female" | "any"; label: string }> = [
  { value: "male", label: "Men" },
  { value: "female", label: "Women" },
  { value: "any", label: "Everyone" },
];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || "");
  const [city, setCity] = useState(user?.location?.city || "");
  const [country, setCountry] = useState(user?.location?.country || "");
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [minAge, setMinAge] = useState(String(user?.preferences?.ageRange?.min || 18));
  const [maxAge, setMaxAge] = useState(String(user?.preferences?.ageRange?.max || 50));
  const [genderPref, setGenderPref] = useState<"male" | "female" | "any">(
    (user?.preferences?.genderPreference as "male" | "female" | "any") || "any"
  );
  const [photos, setPhotos] = useState<string[]>(user?.photos || []);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  }

  async function pickPhoto() {
    if (photos.length >= 3) {
      setError("Maximum 3 photos allowed");
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Photo library permission is required to upload photos");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      setError("Failed to read image data");
      return;
    }

    const mimeType = asset.mimeType || "image/jpeg";
    const base64Data = `data:${mimeType};base64,${asset.base64}`;

    const sizeBytes = Math.ceil(asset.base64.length * 0.75);
    if (sizeBytes > 600 * 1024) {
      setError("Image is too large. Please choose a smaller image.");
      return;
    }

    setError("");
    setUploadingPhoto(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await authedRequest("POST", "/api/profile/photo", { photo: base64Data }, token);
      const data = await res.json();
      setPhotos(data.user.photos || []);
      updateUser({ photos: data.user.photos });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function takePhoto() {
    if (photos.length >= 3) {
      setError("Maximum 3 photos allowed");
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setError("Camera permission is required to take photos");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      setError("Failed to read image data");
      return;
    }

    const mimeType = asset.mimeType || "image/jpeg";
    const base64Data = `data:${mimeType};base64,${asset.base64}`;

    setError("");
    setUploadingPhoto(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const res = await authedRequest("POST", "/api/profile/photo", { photo: base64Data }, token);
      const data = await res.json();
      setPhotos(data.user.photos || []);
      updateUser({ photos: data.user.photos });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setError(err.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function deletePhoto(index: number) {
    setUploadingPhoto(true);
    try {
      const res = await authedRequest("DELETE", `/api/profile/photo/${index}`, undefined, token);
      const data = await res.json();
      setPhotos(data.user.photos || []);
      updateUser({ photos: data.user.photos });
    } catch (err: any) {
      setError(err.message || "Failed to delete photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  function confirmDeletePhoto(index: number) {
    if (Platform.OS !== "web") {
      Alert.alert("Remove Photo", "Are you sure you want to remove this photo?", [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deletePhoto(index) },
      ]);
    } else {
      deletePhoto(index);
    }
  }

  function showPhotoOptions() {
    if (Platform.OS !== "web") {
      Alert.alert("Add Photo", "Choose a source", [
        { text: "Camera", onPress: takePhoto },
        { text: "Photo Library", onPress: pickPhoto },
        { text: "Cancel", style: "cancel" },
      ]);
    } else {
      pickPhoto();
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updates = {
        bio,
        interests,
        location: { city, country },
        preferences: {
          ageRange: {
            min: Math.max(18, parseInt(minAge) || 18),
            max: Math.min(100, parseInt(maxAge) || 50),
          },
          genderPreference: genderPref,
        },
      };
      const res = await authedRequest("PUT", "/api/profile", updates, token);
      const data = await res.json();
      updateUser(data.user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
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

      {!!error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={14} color={Colors.error} />
          <Text style={styles.errorBannerText}>{error}</Text>
          <Pressable onPress={() => setError("")}>
            <Ionicons name="close" size={14} color={Colors.error} />
          </Pressable>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionSubtitle}>Add up to 3 photos (portrait format recommended)</Text>
          <View style={styles.photosGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoSlot}>
                <Image source={{ uri: photo }} style={styles.photoImg} resizeMode="cover" />
                <Pressable
                  style={styles.photoDeleteBtn}
                  onPress={() => confirmDeletePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </Pressable>
                {index === 0 && (
                  <View style={styles.mainPhotoLabel}>
                    <Text style={styles.mainPhotoLabelText}>Main</Text>
                  </View>
                )}
              </View>
            ))}
            {photos.length < 3 && (
              <Pressable
                style={styles.addPhotoBtn}
                onPress={showPhotoOptions}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <LinearGradient
                      colors={["#FFF0F2", "#FFE0E5"]}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.addPhotoIcon}>
                      <Ionicons name="camera" size={24} color={Colors.primary} />
                    </View>
                    <Text style={styles.addPhotoText}>Add Photo</Text>
                  </>
                )}
              </Pressable>
            )}
            {[...Array(Math.max(0, 2 - photos.length))].map((_, i) => (
              <View key={`empty-${i}`} style={styles.emptyPhotoSlot} />
            ))}
          </View>
        </View>

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
                  key={g.value}
                  style={[
                    styles.genderPrefBtn,
                    genderPref === g.value && styles.genderPrefBtnActive,
                  ]}
                  onPress={() => setGenderPref(g.value)}
                >
                  <Text
                    style={[
                      styles.genderPrefText,
                      genderPref === g.value && styles.genderPrefTextActive,
                    ]}
                  >
                    {g.label}
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
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#FCA5A5",
  },
  errorBannerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.error,
    flex: 1,
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
  photosGrid: {
    flexDirection: "row",
    gap: 10,
  },
  photoSlot: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
  },
  photoImg: {
    width: "100%",
    height: "100%",
  },
  photoDeleteBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  mainPhotoLabel: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mainPhotoLabelText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    color: "#fff",
  },
  addPhotoBtn: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addPhotoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF0F2",
    alignItems: "center",
    justifyContent: "center",
  },
  addPhotoText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: Colors.primary,
  },
  emptyPhotoSlot: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    borderWidth: 1.5,
    borderColor: "#EBEBEB",
    borderStyle: "dashed",
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
  interestChipDisabled: { opacity: 0.4 },
  interestText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  interestTextSelected: { color: Colors.primary },
  genderPrefRow: { flexDirection: "row", gap: 8 },
  genderPrefBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  genderPrefBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: "#FFF0F2",
  },
  genderPrefText: {
    fontFamily: "Inter_600SemiBold",
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
