import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketServer } from "socket.io";
import crypto from "crypto";
import { storage, rateLimitMap } from "./storage";

const JWT_SECRET = process.env.SESSION_SECRET || "connectly_jwt_secret_fallback";
const JWT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const FREE_SWIPE_LIMIT = 10;
const FREE_MESSAGE_LIMIT = 5;
const MAX_PHOTO_SIZE_BYTES = 600 * 1024;
const MAX_PHOTOS = 3;
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

interface ResetTokenEntry {
  userId: string;
  code: string;
  expiresAt: number;
  used: boolean;
}
const resetTokens = new Map<string, ResetTokenEntry>();

function generateResetCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function cleanExpiredTokens() {
  const now = Date.now();
  for (const [key, entry] of resetTokens) {
    if (now > entry.expiresAt) resetTokens.delete(key);
  }
}

function signJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + JWT_EXPIRY_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token: string): { userId: string; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

function addSecurityHeaders(res: Response) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.removeHeader("X-Powered-By");
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  addSecurityHeaders(res);
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  if (!token || token.length > 2048) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }
  const payload = verifyJwt(token);
  if (!payload) {
    res.status(401).json({ message: "Token expired or invalid" });
    return;
  }
  const user = storage.findUserById(payload.userId);
  if (!user) {
    res.status(401).json({ message: "User not found" });
    return;
  }
  if (user.isBanned) {
    res.status(403).json({ message: "Account suspended" });
    return;
  }
  (req as any).userId = payload.userId;
  next();
}

function sanitizeUser(user: any) {
  const { passwordHash, passwordSalt, ...safe } = user;
  return safe;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function validateGender(gender: string): gender is "male" | "female" {
  return gender === "male" || gender === "female";
}

function validateGenderPref(g: string): g is "male" | "female" | "any" {
  return g === "male" || g === "female" || g === "any";
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  app.use((req, res, next) => {
    addSecurityHeaders(res);
    next();
  });

  const io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  const userSockets = new Map<string, string>();

  io.on("connection", (socket) => {
    socket.on("authenticate", (token: string) => {
      if (typeof token !== "string" || token.length > 2048) return;
      const payload = verifyJwt(token);
      if (payload) {
        userSockets.set(payload.userId, socket.id);
        socket.data.userId = payload.userId;
      }
    });

    socket.on("typing", ({ matchId, isTyping }: { matchId: string; isTyping: boolean }) => {
      if (typeof matchId !== "string") return;
      socket.to(`match:${matchId}`).emit("typing", { userId: socket.data.userId, isTyping });
    });

    socket.on("joinMatch", (matchId: string) => {
      if (typeof matchId !== "string") return;
      socket.join(`match:${matchId}`);
    });

    socket.on("disconnect", () => {
      if (socket.data.userId) userSockets.delete(socket.data.userId);
    });
  });

  app.post("/api/auth/register", (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
    if (!rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({ message: "Too many registration attempts. Try again later." });
    }

    try {
      const { email, password, name, age, gender } = req.body;
      if (!email || !password || !name || !age || !gender) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (!validateEmail(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      if (typeof password !== "string" || password.length < 6 || password.length > 128) {
        return res.status(400).json({ message: "Password must be 6–128 characters" });
      }
      if (!validateGender(gender)) {
        return res.status(400).json({ message: "Gender must be male or female" });
      }
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
        return res.status(400).json({ message: "You must be at least 18 years old" });
      }
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60) {
        return res.status(400).json({ message: "Name must be 2–60 characters" });
      }

      const user = storage.createUser({ email, password, name, age: ageNum, gender });
      const token = signJwt({ userId: user.id });
      return res.status(201).json({ token, user: sanitizeUser(user) });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
    if (!rateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
      return res.status(429).json({ message: "Too many login attempts. Try again in 15 minutes." });
    }

    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      if (!validateEmail(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const user = storage.findUserByEmail(email);
      if (!user) {
        await new Promise((r) => setTimeout(r, 100));
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (!storage.verifyPassword(password, user.passwordHash, user.passwordSalt)) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (user.isBanned) {
        return res.status(403).json({ message: "Account suspended. Contact support." });
      }

      const token = signJwt({ userId: user.id });
      return res.json({ token, user: sanitizeUser(user) });
    } catch (err: any) {
      return res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
    if (!rateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000)) {
      return res.status(429).json({ message: "Too many reset attempts. Try again in an hour." });
    }

    try {
      const { email } = req.body;
      if (!email || !validateEmail(email)) {
        await new Promise((r) => setTimeout(r, 200));
        return res.json({ message: "If that email is registered, you will receive a reset code." });
      }

      cleanExpiredTokens();
      const user = storage.findUserByEmail(email);

      if (!user) {
        await new Promise((r) => setTimeout(r, 200));
        return res.json({ message: "If that email is registered, you will receive a reset code." });
      }

      const code = generateResetCode();
      const tokenKey = `${user.id}:${Date.now()}`;
      resetTokens.set(tokenKey, {
        userId: user.id,
        code,
        expiresAt: Date.now() + RESET_TOKEN_EXPIRY_MS,
        used: false,
      });

      console.log(`[PASSWORD RESET] Code for ${email}: ${code} (expires in 15 min)`);

      return res.json({
        message: "If that email is registered, you will receive a reset code.",
        _devCode: process.env.NODE_ENV !== "production" ? code : undefined,
      });
    } catch (err: any) {
      return res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
    if (!rateLimit(`reset:${ip}`, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ message: "Too many attempts. Try again later." });
    }

    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ message: "Email, code, and new password are required" });
      }
      if (!validateEmail(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      if (typeof newPassword !== "string" || newPassword.length < 6 || newPassword.length > 128) {
        return res.status(400).json({ message: "Password must be 6–128 characters" });
      }
      if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "Code must be a 6-digit number" });
      }

      const user = storage.findUserByEmail(email);
      if (!user) {
        await new Promise((r) => setTimeout(r, 200));
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      cleanExpiredTokens();
      const now = Date.now();

      const tokenEntry = Array.from(resetTokens.entries())
        .find(([_, entry]) =>
          entry.userId === user.id &&
          !entry.used &&
          now < entry.expiresAt &&
          entry.code === code
        );

      if (!tokenEntry) {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      tokenEntry[1].used = true;
      storage.changePassword(user.id, newPassword);

      const token = signJwt({ userId: user.id });
      const updatedUser = storage.findUserById(user.id);
      return res.json({ message: "Password reset successfully", token, user: sanitizeUser(updatedUser!) });
    } catch (err: any) {
      return res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  app.get("/api/auth/me", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    const user = storage.findUserById(userId);
    if (!user) return res.status(404).json({ message: "Not found" });
    return res.json({ user: sanitizeUser(user) });
  });

  app.delete("/api/auth/account", authMiddleware, (req, res) => {
    const userId = (req as any).userId;
    storage.deleteUser(userId);
    return res.json({ message: "Account deleted" });
  });

  app.put("/api/profile", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const { bio, interests, location, preferences, name, age } = req.body;
      const updates: any = {};

      if (bio !== undefined) {
        updates.bio = String(bio).slice(0, 300);
      }
      if (Array.isArray(interests)) {
        updates.interests = interests.slice(0, 8).map((i: any) => String(i).slice(0, 30));
      }
      if (location && typeof location === "object") {
        updates.location = {
          city: String(location.city || "").slice(0, 60),
          country: String(location.country || "").slice(0, 60),
        };
      }
      if (preferences && typeof preferences === "object") {
        const pref: any = {};
        if (preferences.ageRange) {
          pref.ageRange = {
            min: Math.max(18, Math.min(100, parseInt(preferences.ageRange.min) || 18)),
            max: Math.max(18, Math.min(100, parseInt(preferences.ageRange.max) || 50)),
          };
        }
        if (preferences.genderPreference !== undefined) {
          if (!validateGenderPref(preferences.genderPreference)) {
            return res.status(400).json({ message: "Invalid gender preference" });
          }
          pref.genderPreference = preferences.genderPreference;
        }
        updates.preferences = pref;
      }
      if (name !== undefined) {
        const n = String(name).trim();
        if (n.length < 2 || n.length > 60) {
          return res.status(400).json({ message: "Name must be 2–60 characters" });
        }
        updates.name = n;
      }
      if (age !== undefined) {
        const ageNum = parseInt(age, 10);
        if (isNaN(ageNum) || ageNum < 18 || ageNum > 100) {
          return res.status(400).json({ message: "Invalid age" });
        }
        updates.age = ageNum;
      }

      const updated = storage.updateUser(userId, updates);
      return res.json({ user: sanitizeUser(updated) });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/profile/photo", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const { photo } = req.body;

      if (!photo || typeof photo !== "string") {
        return res.status(400).json({ message: "Photo data is required" });
      }

      if (!photo.startsWith("data:image/")) {
        return res.status(400).json({ message: "Invalid image format" });
      }

      const allowedFormats = ["data:image/jpeg", "data:image/jpg", "data:image/png", "data:image/webp"];
      const isAllowed = allowedFormats.some((fmt) => photo.startsWith(fmt));
      if (!isAllowed) {
        return res.status(400).json({ message: "Only JPEG, PNG, and WebP images are allowed" });
      }

      const base64Data = photo.split(",")[1] || "";
      const sizeBytes = Math.ceil(base64Data.length * 0.75);
      if (sizeBytes > MAX_PHOTO_SIZE_BYTES) {
        return res.status(400).json({ message: "Image too large. Maximum size is 600KB." });
      }

      const user = storage.findUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (user.photos.length >= MAX_PHOTOS) {
        return res.status(400).json({ message: `Maximum ${MAX_PHOTOS} photos allowed` });
      }

      const photos = [...user.photos, photo];
      const updated = storage.updateUser(userId, { photos });
      return res.json({ user: sanitizeUser(updated) });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/profile/photo/:index", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const index = parseInt(req.params.index, 10);
      const user = storage.findUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (isNaN(index) || index < 0 || index >= user.photos.length) {
        return res.status(400).json({ message: "Invalid photo index" });
      }

      const photos = user.photos.filter((_, i) => i !== index);
      const updated = storage.updateUser(userId, { photos });
      return res.json({ user: sanitizeUser(updated) });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/discover", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const profiles = storage.getDiscoverProfiles(userId);
      return res.json({ profiles: profiles.map(sanitizeUser) });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to load profiles" });
    }
  });

  app.post("/api/swipe", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const { targetId, direction } = req.body;

      if (!targetId || typeof targetId !== "string") {
        return res.status(400).json({ message: "targetId is required" });
      }
      if (!["like", "pass", "superlike"].includes(direction)) {
        return res.status(400).json({ message: "direction must be like, pass, or superlike" });
      }

      const user = storage.findUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!user.isPremium && direction !== "pass") {
        const today = new Date().toISOString().split("T")[0];
        const swipesUsed = user.lastSwipeReset === today ? user.swipesUsedToday : 0;
        if (swipesUsed >= FREE_SWIPE_LIMIT) {
          return res.status(403).json({
            message: "Daily swipe limit reached. Upgrade to Premium for unlimited swipes.",
            limitReached: true,
          });
        }
      }

      const { swipe, match } = storage.recordSwipe(userId, targetId, direction);

      if (match) {
        const otherSocketId = userSockets.get(targetId);
        if (otherSocketId) {
          io.to(otherSocketId).emit("newMatch", { match, user: sanitizeUser(user) });
        }
      }

      return res.json({ swipe, match, isMatch: !!match });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/matches", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const matchData = storage.getMatches(userId);
      return res.json({
        matches: matchData.map(({ match, otherUser, lastMessage, unreadCount }) => ({
          match,
          user: sanitizeUser(otherUser),
          lastMessage,
          unreadCount,
        })),
      });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to load matches" });
    }
  });

  app.get("/api/messages/:matchId", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const matchId = req.params.matchId;
      if (!/^[a-f0-9]+$/.test(matchId)) {
        return res.status(400).json({ message: "Invalid match ID" });
      }
      storage.markMessagesRead(matchId, userId);
      const msgs = storage.getMessages(matchId);
      return res.json({ messages: msgs });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to load messages" });
    }
  });

  app.post("/api/messages/:matchId", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const matchId = req.params.matchId;
      const { content } = req.body;

      if (!/^[a-f0-9]+$/.test(matchId)) {
        return res.status(400).json({ message: "Invalid match ID" });
      }
      if (!content?.trim() || typeof content !== "string") {
        return res.status(400).json({ message: "Message cannot be empty" });
      }
      if (content.length > 1000) {
        return res.status(400).json({ message: "Message too long" });
      }

      const ip = (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
      if (!rateLimit(`msg:${userId}:${ip}`, 30, 60 * 1000)) {
        return res.status(429).json({ message: "Sending too many messages. Slow down." });
      }

      const user = storage.findUserById(userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      if (!user.isPremium) {
        const today = new Date().toISOString().split("T")[0];
        const msgsUsed = user.lastMessageReset === today ? user.messagesUsedToday : 0;
        if (msgsUsed >= FREE_MESSAGE_LIMIT) {
          return res.status(403).json({
            message: "Daily message limit reached. Upgrade to Premium for unlimited messaging.",
            limitReached: true,
          });
        }
      }

      const message = storage.sendMessage(matchId, userId, content.trim());
      io.to(`match:${matchId}`).emit("newMessage", message);
      return res.status(201).json({ message });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/likes", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const user = storage.findUserById(userId);
      if (!user) return res.status(404).json({ message: "Not found" });
      const likers = storage.getUsersWhoLiked(userId);
      if (!user.isPremium) {
        return res.json({ count: likers.length, profiles: [] });
      }
      return res.json({ count: likers.length, profiles: likers.map(sanitizeUser) });
    } catch (err: any) {
      return res.status(500).json({ message: "Failed to load likes" });
    }
  });

  app.post("/api/subscription/upgrade", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const { plan, cardLast4 } = req.body;
      const validPlans = ["monthly", "annual", "weekly"];
      if (plan && !validPlans.includes(plan)) {
        return res.status(400).json({ message: "Invalid plan" });
      }
      const planName = plan || "monthly";
      const updated = storage.updateUser(userId, {
        isPremium: true,
        subscriptionPlan: planName,
        subscriptionStarted: new Date().toISOString(),
      } as any);
      return res.json({ user: sanitizeUser(updated), message: `${planName.charAt(0).toUpperCase() + planName.slice(1)} plan activated!` });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/subscription/cancel", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const updated = storage.updateUser(userId, {
        isPremium: false,
        subscriptionPlan: null,
      } as any);
      return res.json({ user: sanitizeUser(updated), message: "Subscription cancelled" });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/users", authMiddleware, (req, res) => {
    const allUsers = storage.getAllUsers().map(sanitizeUser);
    return res.json({ users: allUsers });
  });

  app.post("/api/admin/ban/:userId", authMiddleware, (req, res) => {
    const targetId = req.params.userId;
    if (!/^[a-f0-9]+$/.test(targetId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    storage.banUser(targetId);
    return res.json({ message: "User banned" });
  });

  app.delete("/api/admin/users/:userId", authMiddleware, (req, res) => {
    const targetId = req.params.userId;
    if (!/^[a-f0-9]+$/.test(targetId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    storage.deleteUser(targetId);
    return res.json({ message: "User deleted" });
  });

  app.get("/api/admin/stats", authMiddleware, (req, res) => {
    return res.json(storage.getStats());
  });

  return httpServer;
}
