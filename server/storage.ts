import crypto from "crypto";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  name: string;
  age: number;
  gender: "male" | "female";
  bio: string;
  interests: string[];
  location: { city: string; country: string };
  preferences: {
    ageRange: { min: number; max: number };
    genderPreference: "male" | "female" | "any";
  };
  photos: string[];
  isPremium: boolean;
  swipesUsedToday: number;
  messagesUsedToday: number;
  lastSwipeReset: string;
  lastMessageReset: string;
  createdAt: string;
  isBanned: boolean;
}

export interface Swipe {
  id: string;
  swiperId: string;
  targetId: string;
  direction: "like" | "pass" | "superlike";
  createdAt: string;
}

export interface Match {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
}

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  createdAt: string;
  read: boolean;
}

const users = new Map<string, User>();
const swipes = new Map<string, Swipe>();
const matches = new Map<string, Match>();
const messages = new Map<string, Message>();

export const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function generateId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function getDayString(): string {
  return new Date().toISOString().split("T")[0];
}

function hashPasswordPbkdf2(password: string, salt: string): string {
  return crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
}

function createPasswordHash(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(32).toString("hex");
  const hash = hashPasswordPbkdf2(password, salt);
  return { hash, salt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const attempt = hashPasswordPbkdf2(password, salt);
  return crypto.timingSafeEqual(Buffer.from(attempt), Buffer.from(hash));
}

const DEMO_PROFILES: Array<{
  email: string;
  name: string;
  age: number;
  gender: "male" | "female";
  bio: string;
  interests: string[];
  location: { city: string; country: string };
  preferences: { ageRange: { min: number; max: number }; genderPreference: "male" | "female" | "any" };
  photos: string[];
  isPremium: boolean;
}> = [
  {
    email: "sophia@demo.com",
    name: "Sophia",
    age: 26,
    gender: "female",
    bio: "Adventure seeker and coffee enthusiast. Love hiking on weekends and discovering new restaurants in the city. Looking for someone to explore life with.",
    interests: ["Hiking", "Photography", "Coffee", "Travel", "Yoga"],
    location: { city: "San Francisco", country: "USA" },
    preferences: { ageRange: { min: 24, max: 35 }, genderPreference: "male" },
    photos: [],
    isPremium: false,
  },
  {
    email: "marcus@demo.com",
    name: "Marcus",
    age: 29,
    gender: "male",
    bio: "Software engineer by day, musician by night. I write code and songs. Looking for someone who appreciates both logic and art.",
    interests: ["Music", "Coding", "Rock climbing", "Reading", "Cooking"],
    location: { city: "New York", country: "USA" },
    preferences: { ageRange: { min: 22, max: 32 }, genderPreference: "female" },
    photos: [],
    isPremium: true,
  },
  {
    email: "elena@demo.com",
    name: "Elena",
    age: 24,
    gender: "female",
    bio: "Art curator with a passion for modern design. I spend my weekends at galleries and farmers markets. Always up for a spontaneous road trip.",
    interests: ["Art", "Design", "Cooking", "Travel", "Film"],
    location: { city: "Los Angeles", country: "USA" },
    preferences: { ageRange: { min: 23, max: 34 }, genderPreference: "male" },
    photos: [],
    isPremium: false,
  },
  {
    email: "james@demo.com",
    name: "James",
    age: 31,
    gender: "male",
    bio: "Chef and food writer. I believe the way to anyone's heart is through food. Let me cook you something amazing.",
    interests: ["Cooking", "Wine", "Travel", "Fitness", "Photography"],
    location: { city: "Chicago", country: "USA" },
    preferences: { ageRange: { min: 24, max: 35 }, genderPreference: "female" },
    photos: [],
    isPremium: true,
  },
  {
    email: "luna@demo.com",
    name: "Luna",
    age: 27,
    gender: "female",
    bio: "Veterinarian who rescues animals on weekends. My apartment is a zoo (literally). Looking for someone who loves animals as much as I do.",
    interests: ["Animals", "Nature", "Volunteering", "Yoga", "Books"],
    location: { city: "Austin", country: "USA" },
    preferences: { ageRange: { min: 25, max: 36 }, genderPreference: "male" },
    photos: [],
    isPremium: false,
  },
  {
    email: "alex@demo.com",
    name: "Alex",
    age: 28,
    gender: "male",
    bio: "Architect designing sustainable spaces. I believe buildings should tell stories. Love long runs, great coffee and meaningful conversations.",
    interests: ["Architecture", "Running", "Coffee", "Sustainability", "Jazz"],
    location: { city: "Seattle", country: "USA" },
    preferences: { ageRange: { min: 22, max: 33 }, genderPreference: "female" },
    photos: [],
    isPremium: false,
  },
  {
    email: "nadia@demo.com",
    name: "Nadia",
    age: 25,
    gender: "female",
    bio: "Fashion designer who loves vintage finds. I can spend hours in a thrift store or a museum. Fluent in sarcasm and three languages.",
    interests: ["Fashion", "Art", "Languages", "Travel", "Dancing"],
    location: { city: "Miami", country: "USA" },
    preferences: { ageRange: { min: 24, max: 35 }, genderPreference: "male" },
    photos: [],
    isPremium: false,
  },
  {
    email: "ryan@demo.com",
    name: "Ryan",
    age: 32,
    gender: "male",
    bio: "Marine biologist obsessed with the ocean. I dive with sharks for fun. Looking for someone brave enough to join me underwater.",
    interests: ["Diving", "Ocean", "Science", "Surfing", "Photography"],
    location: { city: "San Diego", country: "USA" },
    preferences: { ageRange: { min: 25, max: 37 }, genderPreference: "female" },
    photos: [],
    isPremium: true,
  },
];

function initializeDemoProfiles() {
  if (users.size === 0) {
    DEMO_PROFILES.forEach((profile) => {
      const id = generateId();
      const today = getDayString();
      const { hash, salt } = createPasswordHash("demo123");
      const user: User = {
        ...profile,
        id,
        passwordHash: hash,
        passwordSalt: salt,
        swipesUsedToday: 0,
        messagesUsedToday: 0,
        lastSwipeReset: today,
        lastMessageReset: today,
        createdAt: new Date().toISOString(),
        isBanned: false,
      };
      users.set(id, user);
    });
  }
}

initializeDemoProfiles();

export const storage = {
  createUser(data: {
    email: string;
    password: string;
    name: string;
    age: number;
    gender: "male" | "female";
  }): User {
    const emailLower = data.email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      throw new Error("Invalid email address");
    }
    const existing = Array.from(users.values()).find(
      (u) => u.email === emailLower
    );
    if (existing) throw new Error("Email already registered");

    if (data.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    if (data.age < 18 || data.age > 100) {
      throw new Error("You must be at least 18 years old");
    }
    if (!["male", "female"].includes(data.gender)) {
      throw new Error("Gender must be male or female");
    }

    const id = generateId();
    const today = getDayString();
    const { hash, salt } = createPasswordHash(data.password);

    const user: User = {
      id,
      email: emailLower,
      passwordHash: hash,
      passwordSalt: salt,
      name: data.name.trim().slice(0, 60),
      age: data.age,
      gender: data.gender,
      bio: "",
      interests: [],
      location: { city: "", country: "" },
      preferences: {
        ageRange: { min: 18, max: 50 },
        genderPreference: "any",
      },
      photos: [],
      isPremium: false,
      swipesUsedToday: 0,
      messagesUsedToday: 0,
      lastSwipeReset: today,
      lastMessageReset: today,
      createdAt: new Date().toISOString(),
      isBanned: false,
    };
    users.set(id, user);
    return user;
  },

  findUserByEmail(email: string): User | undefined {
    return Array.from(users.values()).find(
      (u) => u.email === email.toLowerCase().trim()
    );
  },

  findUserById(id: string): User | undefined {
    return users.get(id);
  },

  verifyPassword,

  updateUser(id: string, updates: Partial<User>): User {
    const user = users.get(id);
    if (!user) throw new Error("User not found");
    const updated = { ...user, ...updates };
    users.set(id, updated);
    return updated;
  },

  deleteUser(id: string): void {
    users.delete(id);
  },

  getDiscoverProfiles(userId: string): User[] {
    const swipedIds = new Set(
      Array.from(swipes.values())
        .filter((s) => s.swiperId === userId)
        .map((s) => s.targetId)
    );

    return Array.from(users.values()).filter((u) => {
      if (u.id === userId) return false;
      if (u.isBanned) return false;
      if (swipedIds.has(u.id)) return false;
      return true;
    });
  },

  recordSwipe(
    swiperId: string,
    targetId: string,
    direction: "like" | "pass" | "superlike"
  ): { swipe: Swipe; match: Match | null } {
    const existingSwipe = Array.from(swipes.values()).find(
      (s) => s.swiperId === swiperId && s.targetId === targetId
    );
    if (existingSwipe) throw new Error("Already swiped on this user");

    const swipe: Swipe = {
      id: generateId(),
      swiperId,
      targetId,
      direction,
      createdAt: new Date().toISOString(),
    };
    swipes.set(swipe.id, swipe);

    let match: Match | null = null;

    if (direction === "like" || direction === "superlike") {
      const mutualSwipe = Array.from(swipes.values()).find(
        (s) =>
          s.swiperId === targetId &&
          s.targetId === swiperId &&
          (s.direction === "like" || s.direction === "superlike")
      );

      if (mutualSwipe) {
        const existingMatch = Array.from(matches.values()).find(
          (m) =>
            (m.user1Id === swiperId && m.user2Id === targetId) ||
            (m.user1Id === targetId && m.user2Id === swiperId)
        );

        if (!existingMatch) {
          match = {
            id: generateId(),
            user1Id: swiperId,
            user2Id: targetId,
            createdAt: new Date().toISOString(),
          };
          matches.set(match.id, match);
        }
      }
    }

    const swiperUser = users.get(swiperId);
    if (swiperUser) {
      const today = getDayString();
      if (swiperUser.lastSwipeReset !== today) {
        swiperUser.swipesUsedToday = 0;
        swiperUser.lastSwipeReset = today;
      }
      swiperUser.swipesUsedToday++;
      users.set(swiperId, swiperUser);
    }

    return { swipe, match };
  },

  getMatches(userId: string): Array<{
    match: Match;
    otherUser: User;
    lastMessage: Message | null;
    unreadCount: number;
  }> {
    const userMatches = Array.from(matches.values()).filter(
      (m) => m.user1Id === userId || m.user2Id === userId
    );

    return userMatches
      .map((match) => {
        const otherUserId =
          match.user1Id === userId ? match.user2Id : match.user1Id;
        const otherUser = users.get(otherUserId);
        if (!otherUser) return null;

        const matchMessages = Array.from(messages.values())
          .filter((m) => m.matchId === match.id)
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

        const lastMessage = matchMessages[0] || null;
        const unreadCount = matchMessages.filter(
          (m) => m.senderId !== userId && !m.read
        ).length;

        return { match, otherUser, lastMessage, unreadCount };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => {
        const aTime = a.lastMessage
          ? new Date(a.lastMessage.createdAt).getTime()
          : new Date(a.match.createdAt).getTime();
        const bTime = b.lastMessage
          ? new Date(b.lastMessage.createdAt).getTime()
          : new Date(b.match.createdAt).getTime();
        return bTime - aTime;
      });
  },

  getMessages(matchId: string): Message[] {
    return Array.from(messages.values())
      .filter((m) => m.matchId === matchId)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
  },

  sendMessage(matchId: string, senderId: string, content: string): Message {
    const match = matches.get(matchId);
    if (!match) throw new Error("Match not found");
    if (match.user1Id !== senderId && match.user2Id !== senderId) {
      throw new Error("Not authorized");
    }

    const message: Message = {
      id: generateId(),
      matchId,
      senderId,
      content: content.slice(0, 1000),
      createdAt: new Date().toISOString(),
      read: false,
    };
    messages.set(message.id, message);

    const sender = users.get(senderId);
    if (sender) {
      const today = getDayString();
      if (sender.lastMessageReset !== today) {
        sender.messagesUsedToday = 0;
        sender.lastMessageReset = today;
      }
      sender.messagesUsedToday++;
      users.set(senderId, sender);
    }

    return message;
  },

  markMessagesRead(matchId: string, userId: string): void {
    Array.from(messages.values())
      .filter((m) => m.matchId === matchId && m.senderId !== userId)
      .forEach((m) => {
        m.read = true;
        messages.set(m.id, m);
      });
  },

  getUsersWhoLiked(userId: string): User[] {
    const likerIds = Array.from(swipes.values())
      .filter(
        (s) =>
          s.targetId === userId &&
          (s.direction === "like" || s.direction === "superlike")
      )
      .map((s) => s.swiperId);

    return likerIds
      .map((id) => users.get(id))
      .filter((u): u is User => u !== undefined && !u.isBanned);
  },

  getAllUsers(): User[] {
    return Array.from(users.values());
  },

  banUser(userId: string): void {
    const user = users.get(userId);
    if (user) {
      user.isBanned = true;
      users.set(userId, user);
    }
  },

  getStats() {
    return {
      totalUsers: users.size,
      premiumUsers: Array.from(users.values()).filter((u) => u.isPremium).length,
      totalMatches: matches.size,
      totalMessages: messages.size,
    };
  },
};
