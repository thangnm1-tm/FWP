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
4. Create `chat_rooms` (identity_revealed = false)
5. Notify both users via FCM

### Reveal Flow
```
NONE → A_REQUESTED → BOTH_ACCEPTED (if B accepts)
                   → DECLINED (if B declines)
NONE → B_REQUESTED → BOTH_ACCEPTED (if A accepts)
                   → DECLINED (if A declines)
```

## Security
- JWT access + refresh tokens
- Argon2/bcrypt password hashing
- Email domain validation (configurable)
- OTP with expiration + max attempts
- Backend enforces identity hiding before reveal
- Location: only approximate distance exposed to clients
