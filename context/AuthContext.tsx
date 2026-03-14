import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/api";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  age: number;
  gender: string;
  bio: string;
  interests: string[];
  location: { city: string; country: string };
  coordinates: { lat: number; lng: number } | null;
  preferences: {
    ageRange: { min: number; max: number };
    genderPreference: string;
    maxDistanceKm: number;
  };
  photos: string[];
  isPremium: boolean;
  swipesUsedToday: number;
  messagesUsedToday: number;
  createdAt: string;
}

interface AuthContextValue {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string; age: number; gender: string }) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<UserProfile>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "@connectly_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredToken();
  }, []);

  async function loadStoredToken() {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken);
        const res = await apiRequest("GET", "/api/auth/me", undefined, storedToken);
        const data = await res.json();
        setUser(data.user);
      }
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function register(data: { email: string; password: string; name: string; age: number; gender: string }) {
    const res = await apiRequest("POST", "/api/auth/register", data);
    const responseData = await res.json();
    await AsyncStorage.setItem(TOKEN_KEY, responseData.token);
    setToken(responseData.token);
    setUser(responseData.user);
  }

  function logout() {
    AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  function updateUser(updates: Partial<UserProfile>) {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }

  async function refreshUser() {
    if (!token) return;
    try {
      const res = await apiRequest("GET", "/api/auth/me", undefined, token);
      const data = await res.json();
      setUser(data.user);
    } catch {}
  }

  const value = useMemo(
    () => ({ user, token, isLoading, login, register, logout, updateUser, refreshUser }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
