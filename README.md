# 🎓 Friend With PTIT (FwP)

**Dating / Friend-matching App with ML Recommendation System**

Ứng dụng kết bạn / hẹn hò dành cho sinh viên PTIT, với hệ thống **Matching & Ranking bằng Machine Learning**.

---

## 📋 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Mobile** | Android (Kotlin, Jetpack Compose, MVVM) |
| **Backend** | NestJS + TypeScript |
| **Database** | PostgreSQL + PostGIS + Redis |
| **ML Service** | Python + FastAPI + LightGBM |
| **Storage** | Cloudinary |
| **Realtime** | WebSocket (Socket.IO) |
| **DevOps** | Docker + Docker Compose |

---

## 🏗️ Project Structure

```
fwp/
├── backend/                # NestJS Backend API
│   └── src/
│       ├── auth/           # Register, Login, OTP, JWT
│       ├── users/          # User entities & service
│       ├── profiles/       # Profile CRUD, GPA bucket
│       ├── interests/      # Interest management, Jaccard
│       ├── preferences/    # User preferences
│       ├── location/       # PostGIS location
│       ├── swipe/          # Swipe events, impression logging
│       ├── matches/        # Match management
│       ├── recommendation/ # ML pipeline integration
│       └── chat/           # Chat, legacy Reveal records, Block, Report
├── ml/                     # Machine Learning Pipeline
│   ├── src/
│   │   ├── datasets/       # Synthetic data generator
│   │   ├── features/       # Feature engineering
│   │   ├── models/         # Training (LR, LightGBM)
│   │   ├── evaluation/     # Metrics (NDCG, PR-AUC, etc.)
│   │   └── serving/        # FastAPI ranking service
│   ├── configs/            # Training configs (YAML)
│   ├── notebooks/          # EDA & exploration
│   └── artifacts/          # Trained models
├── infrastructure/         # SQL migrations, init scripts
├── frontend/               # Web demo (OTP, swipe, profile & chat)
├── android/                # Android Studio / Jetpack Compose demo app
├── docs/                   # Documentation
├── docker-compose.yml
└── .env.example
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local dev)
- Python 3.11+ (for ML)

### 1. Setup Environment
```bash
cp .env.example .env
# Edit .env with your settings
```

### 2. Start Infrastructure
```bash
docker-compose up postgres redis -d
```

### 3. Backend
```bash
cd backend
npm install
npm run start:dev
# API at http://localhost:3000
# Swagger at http://localhost:3000/api/docs
```

### 4. ML Service
```bash
cd ml
pip install -r requirements.txt

# Generate synthetic data
python -m src.datasets.synthetic_generator

# Build features & train model
python -m src.features.build_features
python -m src.models.train --model lightgbm --config configs/lightgbm.yaml

# Start ML service
uvicorn src.serving.app:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Full Docker Setup
```bash
docker-compose up --build
```

### 6. Nạp Dữ Liệu Demo (Synthetic Seed Data)
Dữ liệu demo bao gồm 42 sinh viên PTIT với hồ sơ đầy đủ, 1.200 impressions, 420 swipe events, 9 match và các đoạn chat mẫu. Lệnh này idempotent (chạy lặp lại an toàn, không làm mất dữ liệu người dùng thật).

**Nạp seed demo:**
- **Windows PowerShell:**
  ```powershell
  Get-Content infrastructure/seed-demo.sql | docker exec -i fwp-postgres psql -U fwp_user -d fwp_db
  ```
- **Linux / macOS / Git Bash:**
  ```bash
  docker exec -i fwp-postgres psql -U fwp_user -d fwp_db < infrastructure/seed-demo.sql
  ```
- **Hoặc qua npm:**
  ```bash
  cd backend && npm run seed:demo
  ```

**Tài khoản demo sẵn sàng đăng nhập:**
- **Email:** `demo.student01@stu.ptit.edu.vn` (đến `demo.student42@stu.ptit.edu.vn`)
- **Mật khẩu:** `Demo@123456`
- **Mã OTP (nếu cần):** `123456`

**Reset dữ liệu demo khi cần (chỉ xoá synthetic demo, không xoá volume/user thật):**
- **Windows PowerShell:**
  ```powershell
  Get-Content infrastructure/reset-demo.sql | docker exec -i fwp-postgres psql -U fwp_user -d fwp_db
  ```
- **Linux / macOS / Git Bash:**
  ```bash
  docker exec -i fwp-postgres psql -U fwp_user -d fwp_db < infrastructure/reset-demo.sql
  ```
- **Hoặc qua npm:**
  ```bash
  cd backend && npm run reset:demo
  ```

### 7. Chạy Luồng Retrain Model ML
Retrain model trực tiếp từ dữ liệu swipe thực tế trong PostgreSQL (yêu cầu tối thiểu 100 sự kiện swipe gắn liền với recommendation impression):

```bash
# Chạy retrain ngay lập tức qua container ml-service
docker exec fwp-ml-service python -m scripts.retrain --min-events 100

# Hoặc hot-reload model mới vào FastAPI ranking service
curl -X POST http://localhost:8000/v1/reload
```

Sau khi retrain, model artifact sẽ được lưu tại `ml/artifacts/`, active model được cập nhật và thông tin phiên bản cùng metrics được ghi nhận trong bảng `model_versions` của PostgreSQL.

### 8. Build Ứng Dụng Android Demo
```bash
cd android
./gradlew assembleDebug
# File APK debug: android/app/build/outputs/apk/debug/app-debug.apk
```


---

## 🧠 ML Recommendation Pipeline

```
User opens Swipe Feed
       ↓
Candidate Generation (PostgreSQL + PostGIS)
       ↓
Hard Constraint Filtering (GPA, distance, age)
       ↓
Feature Construction (21 features)
       ↓
ML Scoring (LightGBM via FastAPI)
       ↓
Business Re-ranking + 10% Exploration
       ↓
Top-K Candidates → Android Swipe Feed
```

### Experiments
| # | Model | Purpose |
|---|-------|---------|
| E0 | Random | Lower bound |
| E1 | Rule-based heuristic | Baseline |
| E2 | Logistic Regression | Simple ML |
| E3 | LightGBM | Main model |
| E4 | LambdaMART | Ranking optimization |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register with student email |
| POST | `/auth/login` | Login |
| POST | `/auth/verify-otp/:userId` | Verify OTP |
| GET/PUT | `/profile` | Profile CRUD |
| GET/PUT | `/interests/me` | User interests |
| GET/PUT | `/preferences` | User preferences |
| PUT | `/location` | Update location |
| GET | `/recommendations` | Get swipe feed |
| POST | `/swipe` | Like/Pass |
| GET | `/matches` | Get matches |
| GET/POST | `/chat/:roomId/messages` | Chat |
| POST | `/reveal/:matchId/request` | Deprecated legacy endpoint; returns `410 Gone` |
| POST | `/block` | Block user |
| POST | `/report` | Report user |
| POST | `/profile/photos` | Upload profile photo to Cloudinary |
| POST | `/notifications/device-token` | Register an FCM token |

## Realtime, media and notification configuration

- Connect Socket.IO clients to namespace `/chat` with `auth: { token: <JWT> }`. Events include `room:join`, `message:send`, `message:new`, `typing`, `presence`, and `match:new`.
- OTP is sent using SMTP credentials from `.env`; the API never returns or logs the code.
- Profile photos use Cloudinary. FCM needs the one-line `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable and a device token registered at `/notifications/device-token`.

## Production retraining

`ml-retrainer` in Compose runs every 24 hours by default. It exports only impression-backed actions from `recommendation_impressions` and `swipe_events`, builds the shared feature set, trains LightGBM, promotes the artifact, and records it in `model_versions`. It waits until `RETRAIN_MIN_EVENTS` (default 100) interactions are available.

For the analysis/report, open `ml/notebooks/01_eda_and_model_report.ipynb`. It contains summary EDA, a PR curve, tree feature importance and SHAP analysis. Run ML tests after installing requirements with `python -m pytest tests -q` from `ml/`.

---

## 📄 License

This project is developed as a university assignment (BTL/Đồ án) at PTIT.
