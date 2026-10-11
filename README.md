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
│       └── chat/           # Chat, Reveal, Block, Report
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
| POST | `/reveal/:matchId/request` | Request reveal |
| POST | `/block` | Block user |
| POST | `/report` | Report user |

---

## 📄 License

This project is developed as a university assignment (BTL/Đồ án) at PTIT.
