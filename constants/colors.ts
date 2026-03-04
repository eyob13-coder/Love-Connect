const primary = "#E8445A";
const primaryLight = "#FF6B81";
const primaryDark = "#C73652";

export const Colors = {
  primary,
  primaryLight,
  primaryDark,
  secondary: "#FF8C69",
  accent: "#FFD700",
  
  background: "#FAFAFA",
  backgroundSecondary: "#F5F5F5",
  card: "#FFFFFF",
  
  text: "#1A1A2E",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  textOnPrimary: "#FFFFFF",
  
  border: "#F0F0F0",
  borderFocus: primary,
  
  success: "#10B981",
  error: "#EF4444",
  warning: "#F59E0B",
  
  like: "#4ADE80",
  pass: "#F87171",
  superlike: "#60A5FA",
  
  premium: "#F59E0B",
  premiumDark: "#D97706",
  
  tabBar: "#FFFFFF",
  tabBarBorder: "#F0F0F0",
  tabActive: primary,
  tabInactive: "#9CA3AF",

  shadow: "rgba(0,0,0,0.08)",
  overlay: "rgba(0,0,0,0.4)",

  gradient: {
    start: "#E8445A",
    end: "#FF6B81",
  },
};

export default {
  light: {
    text: Colors.text,
    background: Colors.background,
    tint: Colors.primary,
    tabIconDefault: Colors.tabInactive,
    tabIconSelected: Colors.primary,
  },
};
