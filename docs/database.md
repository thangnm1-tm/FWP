# FwP Database Schema

## Tables Overview

| Table | Description | Key Relationships |
|-------|-------------|-------------------|
| `users` | Core user accounts | Has profile, preferences, location |
| `student_verifications` | OTP verification | Belongs to user |
| `universities` | University registry | Has faculties |
| `faculties` | Faculty/department | Belongs to university |
| `profiles` | User profile data | Belongs to user, university, faculty |
| `interests` | Available interests | Many-to-many with users |
| `user_interests` | User-interest junction | Links users ↔ interests |
| `preferences` | Matching preferences | Belongs to user |
| `user_locations` | GPS + PostGIS point | Belongs to user |
| `swipe_events` | Like/Pass actions | Links viewer → candidate |
| `recommendation_impressions` | ML tracking | Links viewer → candidate + model info |
| `matches` | Mutual likes | Two users |
| `chat_rooms` | Chat after match | Belongs to match |
| `messages` | Chat messages | Belongs to chat_room |
| `reveal_requests` | Identity reveal FSM | Belongs to match |
| `blocks` | User blocks | Blocker → blocked |
| `reports` | User reports | Reporter → reported |
| `device_tokens` | FCM push tokens | Belongs to user |
| `model_versions` | ML model registry | Standalone |

## Key Constraints

### Match Deduplication
```sql
-- Always store lower UUID first
CONSTRAINT match_ordered CHECK (user_a_id < user_b_id)
CREATE UNIQUE INDEX idx_match_unique ON matches(user_a_id, user_b_id);
```

### Swipe Deduplication
```sql
UNIQUE(viewer_user_id, candidate_user_id)
```

### GPA Buckets
```
3 = Giỏi (≥ 3.6)
2 = Khá (3.2 – 3.59)
1 = TB Khá (2.5 – 3.19)
0 = TB (< 2.5)
```

## PostGIS
- `user_locations.point` — `GEOGRAPHY(Point, 4326)`
- GIST index for spatial queries
- `ST_DWithin` for radius search
- `ST_Distance` for distance calculation
