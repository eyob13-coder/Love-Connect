# Connectly - Dating App

## Overview

Connectly is a production-ready SaaS dating mobile application built with React Native (Expo) and a Node.js/Express backend. The app enables users to discover potential matches through a card-swipe interface, chat with matches in real-time, and upgrade to premium for enhanced features.

**Core Features:**
- User registration and authentication (JWT-based)
- Card swipe interface for discovering profiles (like/pass/superlike)
- Match system and real-time messaging via Socket.io
- Premium subscription tier with expanded swipe/message limits
- User profile management with photos, bio, interests, and location
- Profile completeness tracking

**App Name:** Connectly  
**Bundle IDs:** `com.myapp` (iOS/Android)

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend (React Native / Expo)

- **Framework:** Expo SDK ~54 with Expo Router v6 for file-based navigation
- **Navigation Structure:**
  - `(auth)` group: Login and Register screens (modal presentation)
  - `(tabs)` group: Main app tabs — Discover, Matches, Messages, Profile
  - `chat/[id]`: Dynamic chat screen (slide from right)
  - `edit-profile`: Profile editing screen
  - `premium`: Subscription upgrade screen
- **Auth Guard:** `NavigationGuard` component in root layout redirects unauthenticated users to login and authenticated users away from auth screens
- **State Management:** React Context (`AuthContext`) for user session and profile data; TanStack React Query for server state caching
- **Fonts:** Inter (via `@expo-google-fonts/inter`) — Regular, Medium, SemiBold, Bold
- **UI Libraries:** Expo Linear Gradient, Expo Blur, Expo Glass Effect, Expo Haptics, Expo Image Picker
- **Gesture Handling:** React Native Gesture Handler + Reanimated for swipe card interactions with `PanResponder`
- **Keyboard Handling:** `react-native-keyboard-controller` with a web-compatible fallback component (`KeyboardAwareScrollViewCompat`)
- **Platform Handling:** Native iOS Liquid Glass tabs when available, BlurView tab bar on iOS, standard tabs on Android/Web
- **Error Handling:** Class-based `ErrorBoundary` wrapping the app with an `ErrorFallback` UI and app reload capability

### Backend (Node.js / Express)

- **Server:** Express 5 (`server/index.ts`) running on a single port serving both API routes and static web assets
- **Routing:** All API routes registered in `server/routes.ts`
- **Authentication:** Custom JWT implementation using Node.js `crypto` module (HMAC-SHA256). No external JWT library — tokens are manually signed/verified. Token expiry: 7 days
- **Real-time Messaging:** Socket.io (`Server` from `socket.io`) attached to the HTTP server
- **Rate Limiting:** In-memory rate limiting via `rateLimitMap` in `server/storage.ts`
- **CORS:** Dynamic CORS allowing Replit dev/prod domains and localhost origins
- **Security Headers:** `X-Content-Type-Options`, `X-Frame-Options` added to all responses
- **Photo Handling:** Base64-encoded photos stored directly; max 3 photos, max 600KB each
- **Free Tier Limits:** 10 swipes/day, 5 messages/day

### Data Storage

- **Primary Storage (current):** In-memory storage (`server/storage.ts`) — all data lives in memory and resets on server restart. This is a temporary solution.
- **Database (configured but not fully integrated):** PostgreSQL with Drizzle ORM. `drizzle.config.ts` points to `DATABASE_URL` env var. The `shared/schema.ts` defines a basic `users` table with `id`, `username`, `password` columns — this schema needs to be expanded to match the full app data model.
- **Migration Tool:** `drizzle-kit` with `db:push` script
- **Client Storage:** AsyncStorage (`@react-native-async-storage/async-storage`) for persisting JWT tokens on device

**Important:** The in-memory storage in `server/storage.ts` defines the real data model (User, Swipe, Match, Message interfaces) while `shared/schema.ts` only has a minimal placeholder schema. These need to be reconciled when migrating to PostgreSQL.

### API Communication

- **Base URL:** Determined at runtime via `EXPO_PUBLIC_DOMAIN` env var
- **API Client:** Custom `apiRequest` / `authedRequest` functions in `lib/api.ts` using `expo/fetch`
- **Auth Header:** Bearer token sent in `Authorization` header for authenticated requests
- **Error Handling:** Non-OK responses throw errors with parsed message, HTTP status, and a `limitReached` flag for quota errors

### Deployment (Replit)

- **Dev Mode:** `expo:dev` script sets `EXPO_PACKAGER_PROXY_URL` and `REACT_NATIVE_PACKAGER_HOSTNAME` from `REPLIT_DEV_DOMAIN`
- **Production Build:** `scripts/build.js` runs Metro bundler, outputs static web bundle served by Express
- **Server Build:** esbuild bundles `server/index.ts` to `server_dist/` as ESM for production

---

## External Dependencies

### Runtime Services
| Service | Purpose | Status |
|---|---|---|
| PostgreSQL | Primary database | Configured via `DATABASE_URL`, not yet fully used |
| Socket.io | Real-time chat messaging | Integrated in server routes |

### Key NPM Packages
| Package | Purpose |
|---|---|
| `expo-router` | File-based navigation |
| `@tanstack/react-query` | Server state management and caching |
| `drizzle-orm` + `drizzle-kit` | ORM and database migrations |
| `drizzle-zod` | Schema validation from Drizzle tables |
| `socket.io` | WebSocket real-time messaging |
| `express` | HTTP server |
| `pg` | PostgreSQL client |
| `react-native-reanimated` | Smooth animations for swipe cards |
| `react-native-gesture-handler` | Touch gesture recognition |
| `expo-image-picker` | Photo selection from device gallery |
| `expo-linear-gradient` | Gradient UI elements |
| `expo-haptics` | Tactile feedback on swipe actions |
| `expo-blur` | Blurred tab bar on iOS |
| `@react-native-async-storage/async-storage` | Persistent token storage |

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — JWT signing secret (falls back to hardcoded string if missing)
- `EXPO_PUBLIC_DOMAIN` — Domain used by the React Native app to reach the API server
- `REPLIT_DEV_DOMAIN` — Set automatically by Replit for CORS and Metro config
- `REPLIT_DOMAINS` — Set automatically by Replit for production CORS
- `REPLIT_INTERNAL_APP_DOMAIN` — Used by build script for deployment domain detection