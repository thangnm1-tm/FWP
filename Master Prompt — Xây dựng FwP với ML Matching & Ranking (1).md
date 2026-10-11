# MASTER PROMPT: XÂY DỰNG FRIEND WITH PTIT (FwP) — DATING / FRIEND-MATCHING APP CÓ ML RECOMMENDATION

Bạn là **Principal Machine Learning Engineer + Recommender Systems Engineer + Backend Architect + Android Architect** chịu trách nhiệm thiết kế và triển khai từ đầu một hệ thống có tên:

**Friend With PTIT (FwP)**

Đây là ứng dụng kết bạn / hẹn hò / tìm bạn học dành trước tiên cho sinh viên PTIT, sau này có khả năng mở rộng sang nhiều trường đại học.

Điểm quan trọng nhất của dự án không chỉ là làm một ứng dụng swipe giống Tinder, mà là xây dựng một **hệ thống Matching & Recommendation có Machine Learning thực sự**, đủ nghiêm túc để có thể dùng làm Bài tập lớn / Đồ án và có khả năng phát triển thành hệ thống production sau này.

---

# 0. NGUYÊN TẮC LÀM VIỆC

Không được lao ngay vào viết hàng nghìn dòng code.

Trước khi code phải:

1. Phân tích yêu cầu.
2. Kiểm tra các giả định.
3. Xác định kiến trúc.
4. Thiết kế database.
5. Thiết kế event tracking.
6. Thiết kế dataset cho ML.
7. Xác định label và tránh data leakage.
8. Xây baseline.
9. Xác định metric.
10. Sau đó mới triển khai từng module.

Mọi quyết định kỹ thuật phải giải thích:

- Vì sao chọn.
- Có phương án nào khác.
- Trade-off.
- Phương án nào phù hợp với BTL.
- Phương án nào dành cho production sau này.

Không được thêm Deep Learning chỉ để dự án nghe “AI hơn”.

Mỗi model phải có lý do tồn tại và phải được so sánh với baseline đơn giản.

Không được tuyên bố một thuật toán, dataset hoặc kỹ thuật là thứ Tinder/Bumble/Hinge đang sử dụng nếu chưa kiểm chứng bằng nguồn đáng tin cậy.

Nếu thông tin không chắc chắn, ghi rõ:

> Chưa được xác minh.

---

# 1. MỤC TIÊU SẢN PHẨM

Ứng dụng FwP cho phép sinh viên:

- đăng ký bằng email trường;
- xác thực sinh viên;
- tạo hồ sơ;
- nhập trường;
- khoa;
- năm học;
- GPA;
- sở thích;
- bio;
- ảnh;
- giới tính;
- mục đích sử dụng;
- vị trí tương đối;
- tiêu chí người muốn gặp;
- swipe Like / Pass;
- match khi cả hai Like;
- chat sau khi match;
- chat ẩn danh trước khi reveal;
- reveal danh tính nếu cả hai đồng ý;
- block/report;
- nhận push notification.

Điểm đặc biệt:

## GPA Matching

Người dùng được phân thành các GPA bucket ban đầu:

-
  > \= 3.6
- 3.2–3.59
- 2.5–3.19
- < 2.5

Nhưng **không được mặc định coi GPA càng giống nhau thì càng tương thích**.

Đây chỉ là một hypothesis cần kiểm chứng.

GPA similarity phải trở thành một feature của ML thay vì hard-code thành sự thật tuyệt đối.

Cho phép người dùng tự cấu hình:

- chỉ cùng GPA tier;
- lệch tối đa 1 tier;
- không quan tâm GPA.

Nếu người dùng bật filter GPA thì đây có thể là hard constraint.

Nếu không bật, GPA nên chỉ đóng vai trò ranking feature.

---

# 2. TECH STACK

Mobile:

**Android Native**

- Kotlin
- Jetpack Compose
- MVVM
- StateFlow
- Repository Pattern
- Retrofit
- OkHttp
- Room
- Coil
- FCM
- Google Maps SDK
- FusedLocationProviderClient

Backend ưu tiên:

**NestJS + TypeScript**

Có thể phân tích thêm Spring Boot nhưng nếu không có lý do mạnh thì triển khai NestJS.

Database:

- PostgreSQL
- PostGIS
- Redis

Storage:

- Cloudinary hoặc S3-compatible storage

Realtime:

- WebSocket / Socket.IO

ML:

- Python
- pandas
- numpy
- scikit-learn
- LightGBM hoặc XGBoost
- PyTorch chỉ sử dụng khi đi đến Two-Tower / Deep Learning
- sentence-transformers cho text embedding nếu cần
- FastAPI cho inference service
- joblib / ONNX nếu phù hợp
- MLflow nếu không làm hệ thống quá nặng

DevOps:

- Docker
- Docker Compose
- Git
- `.env`
- migration database
- CI cơ bản

---

# 3. KIẾN TRÚC RECOMMENDER SYSTEM

Không xây hệ thống:

```text
SELECT users
ORDER BY compatibility_score
```

một cách đơn giản.

Thiết kế theo kiến trúc recommendation nhiều tầng.

Luồng chuẩn:

```text
User A mở Swipe
        ↓
Candidate Generation
        ↓
Hard Constraint Filtering
        ↓
Feature Construction
        ↓
ML Scoring / Ranking
        ↓
Business Rule Re-ranking
        ↓
Diversity / Exploration
        ↓
Top-K Candidates
        ↓
Android Swipe Feed
```

---

# 4. STAGE 1 — CANDIDATE GENERATION

Candidate Generation không phải ML ở phiên bản đầu.

Sử dụng PostgreSQL + PostGIS.

Ví dụ User A cần tìm người phù hợp.

Filter các điều kiện:

- không phải chính mình;
- account active;
- đã hoàn thiện profile;
- phù hợp preference giới tính;
- phù hợp tuổi;
- trong bán kính cho phép;
- chưa block nhau;
- chưa report nghiêm trọng;
- chưa swipe hoặc tùy chính sách recycle;
- không phải match đang tồn tại;
- phù hợp trường nếu bật filter trường;
- phù hợp GPA constraint nếu người dùng bật constraint.

Candidate generation nên trả về khoảng:

```text
100–1000 candidates
```

thay vì rank toàn bộ database.

Phân tích index Postgres/PostGIS cần có.

Ví dụ:

```text
users
profiles
user_locations
preferences
swipes
matches
blocks
reports
```

Đặc biệt xem xét:

```text
GIST index
```

cho location.

---

# 5. STAGE 2 — ML RANKING

ML chịu trách nhiệm trả lời:

> Trong số những người A có thể nhìn thấy, ai nên được hiển thị trước?

Không chỉ dự đoán:

```text
P(match)
```

một cách ngây thơ.

Phải nghiên cứu ít nhất ba formulation.

---

## FORMULATION A — POINTWISE BINARY CLASSIFICATION

Input:

```text
(A, B, features)
```

Output:

```text
P(A likes B)
```

hoặc:

```text
P(mutual match between A and B)
```

Baseline:

```text
Logistic Regression
```

Advanced tabular:

```text
LightGBM
XGBoost
CatBoost
```

So sánh.

---

# 6. VẤN ĐỀ QUAN TRỌNG: MATCH LÀ HÀNH VI HAI CHIỀU

Dating recommendation khác recommendation phim.

Nếu:

```text
A thích B
```

nhưng:

```text
B không thích A
```

thì recommendation không tạo match.

Do đó nghiên cứu thiết kế:

```text
p_ab = P(A likes B)
p_ba = P(B likes A)
```

Một compatibility score đơn giản:

```text
score(A,B) = p_ab × p_ba
```

hoặc:

```text
sqrt(p_ab × p_ba)
```

hoặc:

```text
min(p_ab, p_ba)
```

So sánh các formulation.

Giải thích ưu nhược điểm.

Có thể xây:

### Model 1

Predict:

```text
P(viewer likes candidate)
```

Sau đó chạy model theo hai chiều.

### Model 2

Predict trực tiếp:

```text
P(mutual_match)
```

### Model 3

Multi-task learning:

```text
head 1 → P(A likes B)
head 2 → P(B likes A)
head 3 → P(mutual match)
```

Không triển khai Model 3 ngay nếu dữ liệu ít.

---

# 7. FORMULATION B — LEARNING TO RANK

Sau baseline classification, nghiên cứu ranking model.

Một training group:

```text
query = viewer A
documents = candidate B1, B2, ..., Bn
```

Relevant label có thể là:

```text
0 = pass
1 = like
2 = mutual match
```

hoặc binary.

Nghiên cứu:

- LightGBM Ranker
- LambdaMART
- pairwise ranking loss

Metric:

```text
NDCG@5
NDCG@10
MRR
Precision@K
Recall@K
MAP@K
```

Giải thích tại sao AUC cao chưa chắc swipe feed tốt.

---

# 8. FORMULATION C — TWO-TOWER MODEL

Chỉ triển khai ở phase nâng cao.

Kiến trúc:

```text
          User A features
                ↓
          Viewer Tower
                ↓
             z_A
                \
                 similarity
                /
             z_B
                ↑
        Candidate Tower
                ↑
          User B features
```

Embedding:

```text
z ∈ R^64 hoặc R^128
```

Score:

```text
dot(z_A, z_B)
```

hoặc cosine similarity.

Viewer tower nhận:

- tuổi;
- giới tính;
- trường;
- khoa;
- GPA tier;
- sở thích;
- preference;
- lịch sử swipe;
- text embedding;
- behavioural embedding.

Candidate tower tương tự.

Loss:

```text
binary cross entropy
```

hoặc contrastive / sampled softmax.

Sau này có thể:

```text
Two-Tower → retrieve Top 500
LightGBM → rerank Top 500
```

Đây là kiến trúc production-oriented.

Không triển khai nếu dataset không đủ.

---

# 9. DATASET NGHIÊN CỨU BAN ĐẦU

Nghiên cứu và kiểm chứng availability, license và schema của các dataset sau trước khi sử dụng:

### Speed Dating Experiment

Dùng để nghiên cứu:

```text
match prediction
```

Các thuộc tính có thể bao gồm:

- age;
- preference;
- attractiveness;
- sincerity;
- intelligence;
- ambition;
- shared interest;
- match.

Không assume tất cả column tồn tại cho đến khi inspect dataset.

---

### OkCupid Profiles

Dùng nghiên cứu:

- demographic;
- education;
- lifestyle;
- interests;
- essays;
- profile representation.

Không được biến:

```text
education = GPA
```

một cách trực tiếp.

Education chỉ có thể dùng để nghiên cứu profile representation hoặc simulated feature distribution.

---

### Libimseti

Dùng nghiên cứu collaborative filtering / interaction prediction nếu dataset thực sự truy cập được.

Kiểm chứng:

- license;
- schema;
- sparsity;
- user count;
- interaction definition.

---

# 10. KHÔNG TRỘN DATASET MỘT CÁCH NGÂY THƠ

Speed Dating:

```text
interaction-level dataset
```

OkCupid:

```text
profile-level dataset
```

Libimseti:

```text
rating / interaction matrix
```

Không concatenate ba dataset thành một dataframe.

Thay vào đó chúng phục vụ các experiment riêng.

Ví dụ:

```text
Experiment A
Speed Dating → match classifier

Experiment B
OkCupid → profile representation / text embedding

Experiment C
Libimseti → collaborative filtering
```

Sau đó rút ra kiến thức / pretraining / pipeline để chuẩn bị cho dữ liệu FwP.

Final FwP model phải dần được retrain bằng:

```text
FwP first-party interaction data.
```

---

# 11. SYNTHETIC DATA

Có thể tạo synthetic data vì lúc đầu FwP chưa có users.

Nhưng synthetic data chỉ được dùng cho:

- test pipeline;
- test API;
- test database;
- test training script;
- benchmark infrastructure;
- demo model;
- integration testing.

Không được dùng kết quả synthetic để tuyên bố:

> GPA giống nhau thật sự làm tăng khả năng match.

Nếu generator được viết theo rule:

```python
if same_gpa:
    probability += 0.2
```

thì model học được same GPA là tốt chỉ vì chính chúng ta đã ép quy luật đó vào dữ liệu.

Đây là circular reasoning.

Phải ghi rõ trong báo cáo.

---

# 12. THIẾT KẾ EVENT TRACKING NGAY TỪ NGÀY ĐẦU

Đây là phần cực kỳ quan trọng.

Nếu app không log interaction đúng, sau này không thể train ML.

Thiết kế bảng:

```text
recommendation_impressions
```

Ví dụ schema:

```text
id
viewer_user_id
candidate_user_id
request_id
rank_position
model_version
candidate_generation_version
score
shown_at
```

---

Bảng:

```text
swipe_events
```

```text
id
viewer_user_id
candidate_user_id
action
impression_id
timestamp
session_id
```

action:

```text
LIKE
PASS
SUPERLIKE   // nếu sau này có
```

---

Bảng:

```text
match_events
```

```text
user_a
user_b
matched_at
```

---

Có thể log thêm:

```text
chat_started
message_count_24h
reveal_requested
reveal_accepted
unmatched
blocked
reported
```

Nhưng phải phân biệt:

```text
training label
```

và:

```text
business analytics.
```

---

# 13. LABEL DESIGN

Không được chọn label mà không phân tích.

Các khả năng:

### Label 1

```text
A liked B
```

Ưu điểm:

- nhiều data;
- feedback nhanh.

Nhược điểm:

- chỉ phản ánh một chiều.

---

### Label 2

```text
mutual_match
```

Ưu điểm:

- sát mục tiêu sản phẩm.

Nhược:

- positive cực ít;
- delayed feedback;
- phụ thuộc hai users.

---

### Label 3

Quality Match:

```text
matched
AND exchanged >= N messages
```

Ví dụ:

```text
>= 5 messages within 48 hours
```

Đây có thể là objective dài hạn tốt hơn.

Nhưng không dùng cho MVP nếu dataset quá nhỏ.

---

Đề xuất xây hierarchy:

```text
Impression
   ↓
Like
   ↓
Mutual Match
   ↓
Conversation
   ↓
Reveal
```

Mỗi tầng là một conversion event.

---

# 14. FEATURE ENGINEERING

Không đưa raw user ID vào model baseline.

Feature nên chia thành nhóm.

## A. VIEWER FEATURES

```text
age_A
school_A
faculty_A
year_A
gpa_A
gpa_bucket_A
interest_count_A
profile_completion_A
```

---

## B. CANDIDATE FEATURES

Tương tự:

```text
age_B
faculty_B
year_B
gpa_bucket_B
```

---

## C. PAIR FEATURES

Đây là phần quan trọng nhất.

```text
age_diff
same_school
same_faculty
same_year
gpa_diff
gpa_bucket_diff
same_gpa_bucket
distance_km
common_interest_count
interest_jaccard
bio_similarity
```

Ví dụ:

```text
interest_jaccard =
|interest_A ∩ interest_B|
/
|interest_A ∪ interest_B|
```

---

## D. PREFERENCE COMPATIBILITY

Ví dụ:

```text
A_age_preference_contains_B
B_age_preference_contains_A

A_distance_preference_contains_B

A_gpa_preference_contains_B
B_gpa_preference_contains_A
```

---

## E. TEXT FEATURES

Bio:

```text
"Tôi thích AI, gym, cafe..."
```

Baseline:

```text
TF-IDF
```

sau đó:

```text
Sentence Transformer
```

Nếu app sử dụng tiếng Việt, đánh giá multilingual sentence embedding.

Pair feature:

```text
cosine(
    bio_embedding_A,
    bio_embedding_B
)
```

Không gửi raw bio đến online model nếu không cần.

Có thể precompute embedding.

---

## F. BEHAVIOURAL FEATURES

Sau khi đủ dữ liệu:

```text
user_like_rate_7d
user_like_rate_30d
candidate_like_rate
candidate_match_rate
viewer_activity_level
candidate_activity_level
days_since_active
```

Cẩn thận popularity bias.

Không để model chỉ đẩy những người vốn đã được nhiều Like.

---

# 15. LOCATION FEATURES

Không lưu / expose location chính xác không cần thiết.

ML chỉ cần:

```text
distance_km
```

hoặc distance bucket:

```text
0–1 km
1–3
3–5
5–10
10–20
20+
```

Có thể transform:

```text
log1p(distance)
```

Không đưa GPS latitude/longitude raw vào model nếu không có lý do.

---

# 16. GPA FEATURES

Nghiên cứu:

```text
abs(gpa_A - gpa_B)
```

```text
same_gpa_bucket
```

```text
gpa_bucket_distance
```

Ví dụ:

```text
Giỏi → 3
Khá → 2
TB khá → 1
TB → 0
```

sau đó:

```text
abs(bucket_A - bucket_B)
```

Nhưng không mặc định ordinal mapping này là hoàn hảo.

So sánh:

- one-hot;
- categorical;
- numeric difference.

Feature importance / SHAP dùng để xem GPA thực sự ảnh hưởng ra sao sau khi có real data.

---

# 17. POSITIVE / NEGATIVE SAMPLES

Positive:

```text
LIKE
```

hoặc:

```text
MATCH
```

Negative không được random toàn bộ user database.

Candidate B chỉ là meaningful negative nếu:

```text
B đã được A nhìn thấy
AND
A PASS B
```

Nếu B chưa từng được hiển thị cho A:

```text
unknown
```

không phải negative.

Đây là distinction quan trọng.

---

# 18. CLASS IMBALANCE

Mutual match có thể hiếm.

Không chỉ nhìn accuracy.

Ví dụ dataset:

```text
95% non-match
5% match
```

Model luôn dự đoán 0:

```text
accuracy = 95%
```

nhưng vô dụng.

Đánh giá:

```text
PR-AUC
ROC-AUC
precision
recall
F1
log loss
Brier score
```

và đặc biệt ranking:

```text
Precision@K
Recall@K
NDCG@K
```

---

# 19. TRAIN / VALIDATION / TEST SPLIT

Không random split ngây thơ.

Dating interactions có time dependency.

Ưu tiên temporal split:

```text
Train:
01/01 → 31/03

Validation:
01/04 → 15/04

Test:
16/04 → 30/04
```

Mục tiêu:

```text
train on past
predict future
```

Ngoài ra nghiên cứu user cold-start split.

Ví dụ test set chứa:

```text
new users chưa từng xuất hiện trong training.
```

---

# 20. DATA LEAKAGE

Audit từng feature.

Ví dụ dự đoán match tại thời điểm:

```text
2026-01-10 14:00
```

không được sử dụng:

```text
future match count
future message count
future reveal state
```

Feature phải tồn tại trước prediction timestamp.

Thiết kế:

```text
feature_timestamp <= prediction_timestamp
```

Phải có mục riêng trong báo cáo:

# Leakage Audit

---

# 21. BASELINE ĐẦU TIÊN

Model 0:

Random ranking.

Model 1:

Rule score.

Ví dụ:

```text
score =
0.25 * interest_similarity
+ 0.20 * distance_score
+ 0.20 * gpa_similarity
+ 0.15 * age_similarity
+ ...
```

Model 2:

```text
Logistic Regression
```

Model 3:

```text
LightGBM
```

Model 4:

```text
Learning-to-Rank
```

Model 5:

```text
Two-Tower
```

Không bỏ qua Model 0–2.

Mục tiêu nghiên cứu là chứng minh:

```text
ML > heuristic
```

chứ không phải chỉ có ML.

---

# 22. LIGHTGBM / XGBOOST EXPERIMENT

Xây reproducible training pipeline.

Cấu trúc:

```text
ml/
├── data/
├── notebooks/
├── src/
│   ├── datasets/
│   ├── features/
│   ├── models/
│   ├── evaluation/
│   └── serving/
├── configs/
├── tests/
└── artifacts/
```

Script:

```text
prepare_data.py
build_features.py
train_logistic.py
train_lightgbm.py
evaluate.py
export_model.py
```

Không để toàn bộ project nằm trong Jupyter notebook.

Notebook chỉ dùng exploration.

Training chính phải chạy bằng CLI.

Ví dụ:

```bash
python -m src.models.train \
    --config configs/lightgbm.yaml
```

---

# 23. REPRODUCIBILITY

Fix:

```text
random seed
dataset version
feature version
model config
package versions
```

Mỗi model cần:

```text
model_version
training_date
dataset_version
feature_version
metrics
```

Có thể dùng:

```text
MLflow
```

hoặc đơn giản:

```text
artifacts/model_v1/
    model.pkl
    metrics.json
    config.yaml
    feature_schema.json
```

---

# 24. MODEL EXPLAINABILITY

Với logistic regression:

- coefficient.

Với tree model:

- feature importance;
- permutation importance;
- SHAP.

Phải kiểm tra:

```text
distance
GPA
faculty
age
interest similarity
```

feature nào đang dominate.

Nếu:

```text
same_gpa_bucket
```

chi phối gần như toàn bộ model, phải kiểm tra bias / data-generation issue.

---

# 25. COLD START

Đây là vấn đề bắt buộc.

New user chưa có swipe history.

Ranking dùng:

```text
profile-based features
preferences
interests
distance
school
faculty
GPA
bio embedding
```

Sau khi có interaction:

```text
content features
+
behaviour features
```

Sau nhiều interactions:

```text
collaborative / embedding features
```

Có thể conceptualize:

```text
Cold Start
   ↓
Content Based
   ↓
Hybrid
   ↓
Collaborative / Behaviour-heavy
```

---

# 26. EXPLORATION VS EXPLOITATION

Nếu luôn show top ML score:

```text
model reinforces itself.
```

Người rank thấp không có impression → không có data → tiếp tục rank thấp.

Đây là feedback loop.

Thiết kế nhẹ:

```text
90% exploitation
10% exploration
```

hoặc:

```text
Top-K + random candidate from eligible pool.
```

Sau này có thể nghiên cứu:

```text
Multi-Armed Bandit
Thompson Sampling
UCB
```

Nhưng không cần triển khai ngay.

---

# 27. POSITION BIAS

Candidate ở vị trí #1 có xác suất được tương tác khác #20.

Log:

```text
rank_position
```

để sau này phân tích.

Không kết luận user thích profile chỉ dựa trên impression thiếu context.

---

# 28. POPULARITY BIAS

Nếu model dùng:

```text
candidate_like_rate
```

nó có thể:

```text
popular → show more
→ get more likes
→ become more popular
```

Đề xuất:

- cap popularity feature;
- normalize;
- diversity;
- exploration;
- exposure fairness analysis.

---

# 29. FAIRNESS

Đây là dating app nên phải đặc biệt chú ý.

Không tối ưu chỉ:

```text
total likes
```

nếu hậu quả là một nhóm nhỏ nhận phần lớn impression.

Theo dõi distribution:

```text
impressions per user
likes per impression
matches per impression
```

Không đưa sensitive attributes vào model nếu không cần.

Không suy đoán:

- tôn giáo;
- xu hướng tính dục;
- dân tộc;
- tình trạng sức khỏe;

từ bio.

---

# 30. PRIVACY

Không expose exact GPA nếu user chọn ẩn.

Model backend vẫn có thể sử dụng:

```text
gpa_bucket
```

nếu policy cho phép.

Location:

không gửi exact coordinate của người B xuống Android.

Frontend chỉ nhận:

```text
distance ≈ 2.3 km
```

hoặc approximate distance.

Không trả:

```text
candidate.latitude
candidate.longitude
```

cho user trước khi policy cho phép.

---

# 31. ONLINE ML ARCHITECTURE

Không để Android gọi ML service trực tiếp.

Architecture:

```text
Android
   ↓
NestJS API
   ↓
Candidate Generator
   ↓
Feature Builder
   ↓
ML Ranking Service
   ↓
Ranked Candidates
   ↓
NestJS
   ↓
Android
```

FastAPI endpoint:

```http
POST /v1/rank
```

Request conceptual:

```json
{
  "viewer_id": "...",
  "candidate_ids": ["...", "..."]
}
```

Nhưng ưu tiên backend gửi features hoặc ML service truy cập feature store/database thông qua layer rõ ràng.

Response:

```json
{
  "model_version": "ranker_v1",
  "results": [
    {
      "candidate_id": "...",
      "score": 0.82
    }
  ]
}
```

Không expose score cho mobile client trừ debug mode.

---

# 32. LATENCY

Swipe feed không được đợi model score từng user bằng 100 REST calls.

Không:

```text
100 candidates
→ 100 API calls
```

Phải:

```text
1 batch request
→ score 100 candidates
```

Target cho BTL:

```text
ranking inference < 200 ms
```

trên batch candidate nhỏ nếu chạy local/demo.

Có thể cache:

```text
pre-ranked feed
```

trong Redis.

---

# 33. FEATURE SERVING

Version đầu:

NestJS query candidate/profile data rồi build feature tương đối đơn giản.

Version sau:

Python feature module dùng chung:

```text
offline training
online serving
```

để giảm training-serving skew.

Phải giải thích:

```text
training-serving skew
```

là gì.

---

# 34. MODEL SERVICE FALLBACK

Nếu ML service chết:

```text
FwP vẫn phải hoạt động.
```

Fallback:

```text
rule-based ranking
```

NestJS flow:

```text
try ML
↓
timeout?
↓
fallback heuristic ranker
```

Đây là yêu cầu bắt buộc.

---

# 35. MODEL RETRAINING

Ban đầu retrain thủ công:

```bash
python train.py
```

Sau này:

```text
weekly retraining
```

Pipeline:

```text
PostgreSQL events
      ↓
dataset snapshot
      ↓
validation
      ↓
feature generation
      ↓
training
      ↓
offline evaluation
      ↓
compare champion/challenger
      ↓
model registry
      ↓
deploy
```

Không auto deploy model mới chỉ vì training chạy xong.

Model mới phải vượt threshold.

---

# 36. CHAMPION / CHALLENGER

Ví dụ production đang dùng:

```text
ranker_v4
```

Train:

```text
ranker_v5
```

Chỉ promote nếu:

```text
NDCG@10 tăng
PR-AUC không giảm đáng kể
calibration acceptable
fairness metrics acceptable
```

---

# 37. MODEL MONITORING

Theo dõi:

### System

```text
latency
error rate
timeout
```

### Data

```text
feature missing rate
distribution shift
```

### Model

```text
predicted score distribution
actual like rate
actual match rate
```

### Product

```text
likes / impression
matches / impression
conversations / match
reveal / match
```

---

# 38. MODEL DRIFT

Theo dõi distribution thay đổi.

Ví dụ:

```text
average distance
GPA distribution
age distribution
interest distribution
```

Có thể nghiên cứu:

```text
PSI
KL divergence
KS test
```

Không cần làm hệ thống drift monitoring quá phức tạp cho BTL nhưng phải mô tả.

---

# 39. EVALUATION FRAMEWORK

Tạo bảng so sánh:

```text
Model
ROC-AUC
PR-AUC
LogLoss
NDCG@5
NDCG@10
Precision@5
Recall@10
Inference latency
```

Ví dụ:

```text
Heuristic
Logistic Regression
Random Forest
LightGBM
LambdaMART
Two-Tower
```

Chỉ đưa model thật sự đã chạy vào bảng kết quả thực nghiệm.

Không bịa metric.

---

# 40. CALIBRATION

Nếu output gọi là:

```text
P(match) = 0.8
```

thì phải kiểm tra calibration.

Sử dụng:

```text
reliability diagram
Brier score
Platt scaling
isotonic regression
```

nếu cần.

Nếu chưa calibration, gọi output:

```text
ranking score
```

thay vì probability.

---

# 41. A/B TESTING

Khi app có đủ user:

Control:

```text
Rule ranking
```

Treatment:

```text
ML ranking
```

Metric:

```text
match rate / impression
conversation rate
retention
```

Không tối ưu swipe count đơn thuần.

Ví dụ model làm user swipe nhiều nhưng match ít:

```text
không phải improvement.
```

---

# 42. DATABASE DESIGN

Thiết kế ERD đầy đủ cho ít nhất:

```text
users
student_verifications
profiles
universities
faculties
interests
user_interests
preferences
user_locations
swipe_events
recommendation_impressions
matches
chat_rooms
messages
reveal_requests
blocks
reports
device_tokens
model_versions
```

Xác định:

- PK;
- FK;
- unique constraints;
- index;
- timestamp;
- soft-delete policy.

Đặc biệt đảm bảo:

```text
LIKE(A,B)
```

không được insert duplicate ngoài ý muốn.

---

# 43. MATCH TRANSACTION

Hai users swipe gần cùng thời điểm.

Phải xử lý race condition.

Khi A LIKE B:

```text
INSERT swipe
↓
check B LIKE A
↓
nếu có
create match
```

Match phải có unique constraint:

```text
(user_low_id, user_high_id)
```

để tránh duplicate.

---

# 44. ANONYMOUS CHAT

Sau match tạo:

```text
chat_room
```

Ban đầu:

```text
identity_revealed = false
```

API không được trả:

- tên thật;
- ảnh thật;
- thông tin ẩn;

trước reveal.

Không chỉ hide ở Android UI.

Backend phải enforce.

---

# 45. REVEAL STATE MACHINE

Thiết kế state:

```text
NONE
A_REQUESTED
B_REQUESTED
BOTH_ACCEPTED
DECLINED
```

Hoặc mô hình đơn giản hơn.

Cả hai phải consent.

Backend là source of truth.

---

# 46. ANDROID ARCHITECTURE

Tổ chức:

```text
app/
core/
data/
domain/
feature-auth/
feature-profile/
feature-swipe/
feature-match/
feature-chat/
feature-map/
```

Không bắt buộc multi-module nếu BTL nhỏ.

Nếu single-module thì vẫn chia package rõ ràng.

UI:

```text
Compose
↓
ViewModel
↓
UseCase
↓
Repository
↓
API / Room
```

Không gọi Retrofit trực tiếp từ Composable.

---

# 47. API DESIGN

Thiết kế REST API cho:

```text
/auth
/profile
/preferences
/swipe
/recommendations
/matches
/chat
/reveal
/report
/block
/location
```

Recommendation:

```http
GET /recommendations
```

hoặc:

```http
POST /recommendations/feed
```

phải trả:

```text
request_id
model_version
candidate list
```

để impression tracking chính xác.

---

# 48. PROJECT STRUCTURE

Đề xuất monorepo:

```text
fwp/
│
├── android/
│
├── backend/
│
├── ml/
│
├── infrastructure/
│
├── docs/
│
├── docker-compose.yml
├── README.md
└── .env.example
```

---

# 49. DOCUMENTATION

Tạo:

```text
docs/
├── architecture.md
├── database.md
├── api.md
├── ml-system-design.md
├── ml-experiments.md
├── event-tracking.md
├── privacy.md
└── deployment.md
```

---

# 50. TESTING

Backend:

```text
unit test
integration test
API test
```

ML:

```text
feature tests
schema tests
training pipeline test
inference consistency test
```

Android:

```text
ViewModel test
Repository test
Compose UI smoke tests
```

Đặc biệt test:

```text
block
match race condition
reveal permission
location privacy
```

---

# 51. SECURITY

Authentication:

```text
JWT access token
refresh token
```

Password:

```text
Argon2 hoặc bcrypt
```

OTP:

- expiration;
- rate limit;
- maximum attempts.

Email domain:

```text
@stu.ptit.edu.vn
```

phải configurable trong database/config vì sau này mở nhiều trường.

Không hard-code PTIT xuyên toàn bộ codebase.

---

# 52. ML SECURITY / ABUSE

Người dùng có thể swipe hàng loạt nhằm manipulate model.

Không blindly treat mọi event giống nhau.

Log:

```text
swipe velocity
sessions
spam behaviour
```

Có thể loại bot/spam interactions khi tạo training dataset.

---

# 53. PHASE TRIỂN KHAI

Thực hiện theo thứ tự.

## Phase 0 — Architecture

Deliverables:

```text
requirements
ERD
system architecture
ML architecture
API contracts
event schema
repo structure
```

---

## Phase 1 — App không ML

Làm:

```text
auth
profile
GPS
preferences
candidate filter
swipe
match
chat
reveal
report/block
```

Recommendation ban đầu:

```text
rule based.
```

---

## Phase 2 — ML Offline

Làm:

```text
dataset analysis
EDA
baseline
feature engineering
Logistic Regression
LightGBM
evaluation
```

Chưa cần production inference.

---

## Phase 3 — ML Serving

Tạo:

```text
FastAPI
/rank
```

NestJS gọi ML service.

Fallback rule ranker.

---

## Phase 4 — Event Collection

Sau khi có users:

```text
impression
swipe
match
chat
```

build first-party dataset.

---

## Phase 5 — Learning To Rank

Thử:

```text
LambdaMART
```

so với LightGBM classifier.

---

## Phase 6 — Two Tower

Chỉ làm nếu đủ interaction.

---

# 54. MVP CHO BÀI TẬP LỚN

Không nhất thiết hoàn thành toàn bộ production architecture.

Một BTL mạnh nên có:

```text
Android app hoạt động
Backend hoạt động
PostgreSQL
PostGIS
Swipe
Match
Anonymous chat
Reveal
Rule-based candidate filtering

+

ML experiment thực sự
Logistic baseline
LightGBM model
Offline metrics
FastAPI ranking service
NestJS → ML integration
Fallback ranking
```

Đây phải là mục tiêu ưu tiên.

---

# 55. OUTPUT TÔI MUỐN BẠN TẠO NGAY

Trước khi code, hãy trả về một tài liệu kỹ thuật gồm các phần sau theo đúng thứ tự:

### PHẦN A — Requirements Audit

Phân tích toàn bộ yêu cầu.

Chỉ ra:

- yêu cầu rõ;
- yêu cầu còn mơ hồ;
- assumption;
- risk kỹ thuật;
- risk ML.

Không hỏi tôi những câu không cần thiết.

Nếu có thể chọn reasonable default thì tự chọn và ghi assumption.

---

### PHẦN B — System Architecture

Vẽ diagram:

```text
Android
Backend
PostgreSQL
PostGIS
Redis
Object Storage
FCM
WebSocket
ML Service
```

Giải thích data flow.

---

### PHẦN C — Database

ERD.

Schema từng bảng.

Index.

Constraint.

---

### PHẦN D — Recommendation Architecture

Mô tả chi tiết:

```text
candidate generation
hard filtering
feature generation
ML ranking
re-ranking
exploration
```

---

### PHẦN E — ML Problem Definition

Xác định chính xác:

```text
input
output
label
training unit
inference unit
objective
```

So sánh:

```text
P(like)
P(mutual_match)
Learning to Rank
```

và chọn một baseline phù hợp nhất cho MVP.

---

### PHẦN F — Data Strategy

Phân tích:

```text
Speed Dating
OkCupid
Libimseti
Synthetic FwP
Real FwP interaction data
```

Không được assume availability.

Nếu có khả năng truy cập Internet, hãy kiểm chứng:

- dataset hiện còn không;
- nguồn chính thức;
- license;
- kích thước;
- column;
- hạn chế.

---

### PHẦN G — Feature Engineering

Lập bảng:

```text
feature
data type
source
transformation
offline availability
online availability
leakage risk
```

---

### PHẦN H — Training Pipeline

Thiết kế:

```text
raw data
→ cleaned data
→ feature table
→ train
→ validation
→ test
→ model
→ evaluation report
```

---

### PHẦN I — Experiment Plan

Ít nhất:

```text
E0 Random
E1 Rule-based
E2 Logistic Regression
E3 LightGBM
E4 LambdaMART
```

Two-Tower ghi là future experiment nếu chưa đủ data.

---

### PHẦN J — Evaluation

Giải thích từng metric.

Không chỉ AUC.

Ưu tiên:

```text
PR-AUC
LogLoss
NDCG@5
NDCG@10
Precision@K
Recall@K
Brier Score
```

---

### PHẦN K — ML Serving

FastAPI API contract.

Batch prediction.

Latency.

Fallback.

Versioning.

---

### PHẦN L — Retraining & Monitoring

Thiết kế:

```text
event logging
dataset building
retraining
model comparison
deployment
monitoring
drift
```

---

### PHẦN M — Privacy / Fairness / Bias

Phân tích sâu đặc biệt đối với:

```text
GPA
distance
popularity bias
gender preference
exposure bias
position bias
feedback loop
```

---

### PHẦN N — Development Roadmap

Chia task thành:

```text
P0
P1
P2
P3
```

Mỗi task có:

```text
objective
files/modules
dependencies
definition of done
```

---

# 56. SAU KHI HOÀN THÀNH THIẾT KẾ

Sau khi xuất toàn bộ architecture, bắt đầu tạo project.

Thứ tự:

```text
1. Monorepo
2. Docker Compose
3. PostgreSQL/PostGIS
4. Backend skeleton
5. Database migrations
6. Auth
7. Profile
8. Preferences
9. Candidate generation
10. Swipe
11. Match
12. Event logging
13. Android client
14. Chat
15. ML pipeline
16. ML service
17. Recommendation integration
18. Tests
19. Documentation
```

Không nhảy cóc.

Sau mỗi milestone:

- build;
- test;
- sửa lỗi;
- cập nhật README.

---

# 57. QUY TẮC KHI VIẾT CODE

Code phải chạy được.

Không tạo placeholder kiểu:

```text
TODO: implement later
```

ở phần được tuyên bố hoàn thành.

Nếu một phần chưa triển khai:

```text
NOT IMPLEMENTED
```

phải nói rõ.

Không bịa kết quả test.

Không bịa metric ML.

Không bịa dataset.

Không bịa API response.

Không bịa dependency version.

Nếu có Internet, kiểm tra version thư viện hiện tại trước khi sử dụng.

---

# 58. ĐẶC BIỆT: KHÔNG OVERENGINEER

Đây trước tiên là một đồ án sinh viên.

Luôn phân biệt:

```text
MVP
```

với:

```text
production future architecture.
```

Ví dụ:

MVP:

```text
PostgreSQL + LightGBM + FastAPI
```

có thể đủ.

Không tự động thêm:

```text
Kafka
Kubernetes
Feast
Spark
Airflow
Kubeflow
```

chỉ để hệ thống trông phức tạp.

Nếu đề xuất chúng phải chứng minh tại sao cần.

---

# 59. CÂU HỎI NGHIÊN CỨU ML CỐT LÕI

Trong báo cáo cuối cùng, hệ thống phải cố gắng trả lời:

> Machine Learning có xếp hạng ứng viên tốt hơn heuristic hay không?

> Similarity về GPA có thực sự cung cấp predictive signal hay chỉ là giả định của sản phẩm?

> Content similarity từ sở thích/bio cải thiện ranking bao nhiêu?

> Khoảng cách địa lý ảnh hưởng như thế nào đến Like / Match probability?

> Predict P(Like) hay P(Mutual Match) phù hợp hơn?

> Classification hay Learning-to-Rank phù hợp hơn với swipe feed?

> Mô hình hoạt động như thế nào với cold-start user?

> Popularity bias và feedback loop ảnh hưởng recommendation như thế nào?

Đây mới là phần làm cho FwP trở thành một dự án Machine Learning thực sự.

---

# 60. BẮT ĐẦU

Bây giờ hãy bắt đầu với:

**PHASE 0 — ARCHITECTURE & ML DESIGN**

Chưa viết toàn bộ ứng dụng ngay.

Hãy tạo trước:

1. Requirements Audit.
2. System Architecture.
3. ERD.
4. Recommendation Architecture.
5. ML Problem Formulation.
6. Dataset Strategy.
7. Label Strategy.
8. Feature Schema.
9. Training / Validation / Test strategy.
10. Baseline experiment plan.
11. ML serving architecture.
12. Privacy, bias và leakage audit.
13. Roadmap triển khai.

Sau đó đề xuất **task đầu tiên nên code**, bao gồm tên file, thư mục, database migration và command cần chạy.

Mục tiêu cuối cùng không phải chỉ là:

> “Có dùng Machine Learning.”

Mà phải tạo được một pipeline có thể chứng minh:

```text
Data
→ Features
→ Model
→ Offline Evaluation
→ Ranking API
→ Real User Events
→ Retraining
→ Improved Recommendation
```

Hãy thiết kế FwP như một **recommender system thật thu nhỏ**, nhưng vẫn giữ phạm vi khả thi cho một nhóm sinh viên triển khai.
