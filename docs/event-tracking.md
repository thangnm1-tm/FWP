# FwP Event Tracking Design

## Mục đích

Event tracking là nền tảng cho ML training. Nếu app không log interaction đúng,
sau này không thể train model.

## Events Schema

### 1. recommendation_impressions
Log mỗi khi user nhìn thấy 1 candidate trong swipe feed.

```sql
recommendation_impressions (
  id UUID,
  viewer_user_id UUID,       -- Ai đang swipe
  candidate_user_id UUID,    -- Ai được hiện
  request_id UUID,           -- Group cùng 1 request
  rank_position INT,         -- Vị trí #1, #2, ...
  model_version VARCHAR,     -- "lgbm_v1", "rule_v1_fallback"
  score FLOAT,               -- ML score (not exposed to client)
  shown_at TIMESTAMPTZ       -- Thời điểm hiển thị
)
```

### 2. swipe_events
Log mỗi action Like/Pass.

```sql
swipe_events (
  id UUID,
  viewer_user_id UUID,
  candidate_user_id UUID,
  action ENUM('LIKE','PASS'),
  impression_id UUID,        -- Link đến impression
  session_id UUID,            -- Group theo session
  created_at TIMESTAMPTZ
)
```

### 3. Downstream events (via matches + chat)
```
match_events    → matched_at
chat_started    → first message timestamp
message_count   → đếm trong 24h/48h
reveal_requested → requester + timestamp
reveal_accepted  → responded_at
unmatched       → match.active = false
blocked         → blocks table
reported        → reports table
```

## Label Hierarchy

```
Impression
   ↓
Like (label_1 = 1)
   ↓
Mutual Match (label_2 = 1)
   ↓
Conversation ≥ 5 messages (quality_match = 1)
   ↓
Reveal (deep_engagement = 1)
```

## Phân biệt Training Label vs Business Analytics

| Data | Training Label? | Analytics? |
|------|----------------|------------|
| Like/Pass | ✅ MVP label | ✅ |
| Mutual match | ✅ Phase 2 label | ✅ |
| Message count | ❌ (future label) | ✅ |
| Reveal | ❌ | ✅ |
| Block/Report | ❌ (filter training) | ✅ |
| Session duration | ❌ | ✅ |

## Position Bias

- `rank_position` được log cho mỗi impression
- Candidate ở position #1 có CTR khác #20
- Cần phân tích sau khi có real data
- Potential: sử dụng Inverse Propensity Weighting

## Swipe Velocity (Anti-abuse)

- Log `session_id` để detect spam swipe
- Có thể loại high-velocity swipes khi build training dataset
- Threshold suggestion: > 100 swipes/minute → suspicious
