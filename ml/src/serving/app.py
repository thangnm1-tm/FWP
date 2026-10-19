"""
FwP ML Ranking Service — FastAPI
POST /v1/rank: Batch scoring for candidate ranking
"""

import os
import time
import logging
import secrets
from typing import Optional

import joblib
import numpy as np
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .features import FeatureBuilder
from .ranker import HeuristicRanker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fwp-ml")

app = FastAPI(
    title="FwP ML Ranking Service",
    description="Machine Learning ranking service for Friend With PTIT",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.environ.get(
        "ML_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-ML-Reload-Token"],
    allow_credentials=True,
)

# ── Global state ──
ml_model = None
model_version = "rule_v1"
feature_builder = None
heuristic_ranker = HeuristicRanker()


def load_model():
    """Load ML model from artifacts directory."""
    global ml_model, model_version

    # Do not retain a previously active model when a reload fails or the
    # active artifact has been removed.
    ml_model = None
    model_version = "rule_v1"

    model_path = os.environ.get("MODEL_PATH", "artifacts/active_model")
    model_file = os.path.join(model_path, "model.pkl")

    if os.path.exists(model_file):
        try:
            ml_model = joblib.load(model_file)
            # Read version
            version_file = os.path.join(model_path, "version.txt")
            if os.path.exists(version_file):
                with open(version_file) as f:
                    model_version = f.read().strip()
            else:
                model_version = "lgbm_v1"
            logger.info(f"Loaded ML model: {model_version}")
        except Exception as e:
            logger.warning(f"Failed to load model: {e}. Using heuristic fallback.")
            ml_model = None
            model_version = "rule_v1"
            return False
    else:
        logger.info("No ML model found. Using heuristic ranker.")
    return ml_model is not None


@app.on_event("startup")
async def startup():
    global feature_builder
    feature_builder = FeatureBuilder()
    load_model()


# ── Request/Response models ──

class RankRequest(BaseModel):
    viewer_id: str
    candidate_ids: list[str]
    request_id: Optional[str] = None


class CandidateScore(BaseModel):
    candidate_id: str
    score: float


class RankResponse(BaseModel):
    model_version: str
    request_id: Optional[str]
    results: list[CandidateScore]
    inference_ms: float


# ── Endpoints ──

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_version": model_version,
        "model_loaded": ml_model is not None,
    }


@app.post("/v1/rank", response_model=RankResponse)
async def rank_candidates(request: RankRequest):
    """
    Score and rank candidates for a viewer.
    Uses ML model if available, otherwise falls back to heuristic.
    """
    start_time = time.time()

    if not request.candidate_ids:
        return RankResponse(
            model_version=model_version,
            request_id=request.request_id,
            results=[],
            inference_ms=0,
        )

    try:
        if ml_model is not None:
            # Build features for all pairs
            features = feature_builder.build_batch_features(
                request.viewer_id,
                request.candidate_ids,
            )

            if features is not None and len(features) > 0:
                # ML model scoring
                scores = ml_model.predict_proba(features)[:, 1]
            else:
                # Feature building failed, use heuristic
                scores = heuristic_ranker.score_batch(
                    request.viewer_id,
                    request.candidate_ids,
                )
        else:
            # No model loaded — heuristic
            scores = heuristic_ranker.score_batch(
                request.viewer_id,
                request.candidate_ids,
            )

        # Sort by score descending
        candidate_scores = list(zip(request.candidate_ids, scores.tolist()))
        candidate_scores.sort(key=lambda x: x[1], reverse=True)

        results = [
            CandidateScore(candidate_id=cid, score=round(score, 4))
            for cid, score in candidate_scores
        ]

    except Exception as e:
        logger.error(f"Ranking error: {e}")
        # Emergency fallback remains deterministic and consistent with the
        # normal no-model path.
        scores = heuristic_ranker.score_batch(request.viewer_id, request.candidate_ids)
        results = [CandidateScore(candidate_id=cid, score=round(float(score), 4))
                   for cid, score in zip(request.candidate_ids, scores)]
        results.sort(key=lambda item: item.score, reverse=True)

    inference_ms = (time.time() - start_time) * 1000

    return RankResponse(
        model_version=model_version,
        request_id=request.request_id,
        results=results,
        inference_ms=round(inference_ms, 2),
    )


@app.post("/v1/reload")
async def reload_model(x_ml_reload_token: Optional[str] = Header(default=None)):
    """Hot-reload the active model."""
    configured_token = os.environ.get("ML_RELOAD_TOKEN")
    if not configured_token:
        raise HTTPException(status_code=503, detail="Model reload is not configured")
    if not x_ml_reload_token or not secrets.compare_digest(x_ml_reload_token, configured_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    loaded = load_model()
    if not loaded:
        return {
            "message": "No valid ML model available; using heuristic ranker",
            "model_version": model_version,
            "model_loaded": False,
        }
    return {"message": "Model reloaded", "model_version": model_version, "model_loaded": True}
