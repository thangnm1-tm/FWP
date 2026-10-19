# FwP System Architecture

## Overview

```
┌──────────────┐     ┌──────────────────────┐     ┌──────────────┐
│   Android    │────▶│   NestJS Backend     │────▶│  PostgreSQL  │
│  (Kotlin +   │◀────│   (TypeScript)       │◀────│  + PostGIS   │
│   Compose)   │     │                      │     └──────────────┘
└──────────────┘     │  REST API + WebSocket │
       │             │                      │     ┌──────────────┐
       │             │  ┌─────────────────┐ │────▶│    Redis     │
       ▼             │  │ Recommendation  │ │     └──────────────┘
  Push Notify        │  │    Module       │ │
  (FCM)              │  └───────┬─────────┘ │     ┌──────────────┐
                     │          │           │────▶│  Cloudinary  │
                     └──────────┼───────────┘     └──────────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │   FastAPI ML Service │
                     │   (Python)           │
                     │                      │
                     │  - Feature Builder   │
                     │  - Model Scoring     │
                     │  - Heuristic Fallback│
                     └──────────────────────┘
```

## Data Flow

### Recommendation Pipeline
1. Android sends `GET /recommendations`
2. NestJS → **Candidate Generation** (PostgreSQL + PostGIS)
3. NestJS → sends candidate IDs to FastAPI `POST /v1/rank`
4. FastAPI → builds features from DB
5. FastAPI → scores with LightGBM (or heuristic fallback)
6. NestJS → applies business rules + 10% exploration
7. NestJS → logs impressions to `recommendation_impressions`
8. NestJS → returns Top-K candidates (without scores) to Android

### Swipe → Match Flow
1. User A **LIKES** User B → `swipe_events` insert
2. Check if B already **LIKED** A
3. If mutual → create `matches` row (with ordered UUIDs)
4. Create one `chat_rooms` row for the active match
5. Return the room ID and the other member's public chat profile to the swiper
6. Notify both users via FCM and Socket.IO

## Security
- JWT access + refresh tokens
- Argon2/bcrypt password hashing
- Email domain validation (configurable)
- OTP with expiration + max attempts
- Chat profile data is returned only to authenticated members of an active match
- Legacy reveal records and `identity_revealed` remain stored for compatibility; they do not control chat identity visibility
- Location: only approximate distance exposed to clients
