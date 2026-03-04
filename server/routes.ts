import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketServer } from "socket.io";
import crypto from "crypto";
import { storage } from "./storage";

const JWT_SECRET = process.env.SESSION_SECRET || "connectly_jwt_secret_2024";
const FREE_SWIPE_LIMIT = 10;
const FREE_MESSAGE_LIMIT = 5;

function signJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token: string): { userId: string } | null {
  try {
    const [header, body, sig] = token.split(".");
    const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
    if (sig !== expectedSig) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyJwt(token);
  if (!payload) {
    res.status(401).json({ message: "Invalid token" });
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
  const { passwordHash, ...safe } = user;
  return safe;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const userSockets = new Map<string, string>();

  io.on("connection", (socket) => {
    socket.on("authenticate", (token: string) => {
      const payload = verifyJwt(token);
      if (payload) {
        userSockets.set(payload.userId, socket.id);
        socket.data.userId = payload.userId;
      }
    });

    socket.on("typing", ({ matchId, isTyping }: { matchId: string; isTyping: boolean }) => {
      socket.to(`match:${matchId}`).emit("typing", { userId: socket.data.userId, isTyping });
    });

    socket.on("joinMatch", (matchId: string) => {
      socket.join(`match:${matchId}`);
    });

    socket.on("disconnect", () => {
      if (socket.data.userId) {
        userSockets.delete(socket.data.userId);
      }
    });
  });

  app.post("/api/auth/register", (req, res) => {
    try {
      const { email, password, name, age, gender } = req.body;
      if (!email || !password || !name || !age || !gender) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      if (age < 18 || age > 100) {
        return res.status(400).json({ message: "You must be at least 18 years old" });
      }
      const user = storage.createUser({ email, password, name, age: Number(age), gender });
      const token = signJwt({ userId: user.id });
      return res.status(201).json({ token, user: sanitizeUser(user) });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = storage.findUserByEmail(email);
      if (!user || !storage.verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ message: "Invalid email or password" });
      }
      if (user.isBanned) {
        return res.status(403).json({ message: "Account suspended" });
      }
      const token = signJwt({ userId: user.id });
      return res.json({ token, user: sanitizeUser(user) });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
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
      const { bio, interests, location, preferences, photos, name, age } = req.body;
      const updates: any = {};
      if (bio !== undefined) updates.bio = bio;
      if (interests !== undefined) updates.interests = interests;
      if (location !== undefined) updates.location = location;
      if (preferences !== undefined) updates.preferences = preferences;
      if (photos !== undefined) updates.photos = photos;
      if (name !== undefined) updates.name = name;
      if (age !== undefined) updates.age = Number(age);
      const updated = storage.updateUser(userId, updates);
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
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/swipe", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const { targetId, direction } = req.body;
      if (!targetId || !direction) {
        return res.status(400).json({ message: "targetId and direction required" });
      }
      if (!["like", "pass", "superlike"].includes(direction)) {
        return res.status(400).json({ message: "Invalid direction" });
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
        const otherUser = storage.findUserById(targetId);
        if (otherUser) {
          const otherSocketId = userSockets.get(targetId);
          if (otherSocketId) {
            io.to(otherSocketId).emit("newMatch", {
              match,
              user: sanitizeUser(user),
            });
          }
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
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/messages/:matchId", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const { matchId } = req.params;
      storage.markMessagesRead(matchId, userId);
      const msgs = storage.getMessages(matchId);
      return res.json({ messages: msgs });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/messages/:matchId", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const { matchId } = req.params;
      const { content } = req.body;
      if (!content?.trim()) {
        return res.status(400).json({ message: "Message cannot be empty" });
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

      if (!user.isPremium) {
        const likers = storage.getUsersWhoLiked(userId);
        return res.json({ count: likers.length, profiles: [] });
      }

      const likers = storage.getUsersWhoLiked(userId);
      return res.json({ count: likers.length, profiles: likers.map(sanitizeUser) });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subscription/upgrade", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const updated = storage.updateUser(userId, { isPremium: true });
      return res.json({ user: sanitizeUser(updated) });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/subscription/cancel", authMiddleware, (req, res) => {
    try {
      const userId = (req as any).userId;
      const updated = storage.updateUser(userId, { isPremium: false });
      return res.json({ user: sanitizeUser(updated) });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/admin/users", authMiddleware, (req, res) => {
    const allUsers = storage.getAllUsers().map(sanitizeUser);
    return res.json({ users: allUsers });
  });

  app.post("/api/admin/ban/:userId", authMiddleware, (req, res) => {
    storage.banUser(req.params.userId);
    return res.json({ message: "User banned" });
  });

  app.delete("/api/admin/users/:userId", authMiddleware, (req, res) => {
    storage.deleteUser(req.params.userId);
    return res.json({ message: "User deleted" });
  });

  app.get("/api/admin/stats", authMiddleware, (req, res) => {
    return res.json(storage.getStats());
  });

  return httpServer;
}
