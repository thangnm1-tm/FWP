"""Periodic retraining entry point. Safe to run once or as a Docker service."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from urllib.request import Request, urlopen
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

from src.datasets.postgres_loader import export_training_data
from src.features.build_features import build_training_features


ROOT = Path(__file__).resolve().parents[1]


def register_model() -> None:
    artifacts = ROOT / "artifacts"
    candidates = [p for p in artifacts.iterdir() if p.is_dir() and p.name != "active_model"]
    if not candidates:
        return
    reload_token = os.getenv("ML_RELOAD_TOKEN")
    if not reload_token:
        raise RuntimeError("ML_RELOAD_TOKEN is required to register and reload a model")
    latest = max(candidates, key=lambda p: p.stat().st_mtime)
    metrics_path = latest / "metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.exists() else {}
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"), port=os.getenv("POSTGRES_PORT", "5432"),
        user=os.getenv("POSTGRES_USER", "fwp_user"), password=os.getenv("POSTGRES_PASSWORD", "fwp_password_change_me"), dbname=os.getenv("POSTGRES_DB", "fwp_db"),
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute("UPDATE model_versions SET is_active = FALSE WHERE is_active = TRUE")
            cursor.execute(
                """INSERT INTO model_versions(version, model_type, metrics, artifact_path, is_active, trained_at, deployed_at)
                   VALUES (%s, %s, %s::jsonb, %s, TRUE, %s, NOW())
                   ON CONFLICT(version) DO UPDATE SET metrics = EXCLUDED.metrics, artifact_path = EXCLUDED.artifact_path, is_active = TRUE, deployed_at = NOW()""",
                (latest.name, "lightgbm", json.dumps(metrics), str(latest), datetime.now(timezone.utc)),
            )
        reload_url = os.getenv("ML_RELOAD_URL", "http://ml-service:8000/v1/reload")
        request = Request(
            reload_url,
            headers={"X-ML-Reload-Token": reload_token},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            if response.status >= 300:
                raise RuntimeError(f"ML reload failed with HTTP {response.status}")
            payload = json.loads(response.read().decode("utf-8"))
            if not payload.get("model_loaded", False):
                raise RuntimeError(f"ML reload failed: {payload.get('message', 'model not loaded')}")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def run_once(min_events: int) -> None:
    raw_dir = ROOT / "data" / "production"
    feature_path = raw_dir / "training_features.csv"
    count = export_training_data(str(raw_dir), min_events=min_events)
    build_training_features(str(raw_dir), str(feature_path))
    subprocess.run([sys.executable, "-m", "src.models.train", "--model", "lightgbm", "--config", "configs/production.yaml"], cwd=ROOT, check=True)
    register_model()
    print(f"Retrained from {count} production swipe events.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-events", type=int, default=int(os.getenv("RETRAIN_MIN_EVENTS", "100")))
    parser.add_argument("--interval-hours", type=float, default=0, help="0 runs once; positive values run continuously")
    args = parser.parse_args()
    while True:
        try:
            run_once(args.min_events)
        except Exception as error:
            print(f"Retrain skipped/failed: {error}", file=sys.stderr)
        if args.interval_hours <= 0:
            break
        time.sleep(args.interval_hours * 3600)


if __name__ == "__main__":
    main()
