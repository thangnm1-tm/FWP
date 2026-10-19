"""
FwP ML Training Pipeline
Usage: python -m src.models.train --config configs/lightgbm.yaml
"""

import argparse
import json
import os
import time
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
import yaml
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    log_loss,
    brier_score_loss,
    precision_score,
    recall_score,
    f1_score,
)

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False

from ..features.build_features import build_training_features
from ..evaluation.metrics import compute_ranking_metrics


FEATURE_COLUMNS = [
    "age_a", "age_b", "age_diff",
    "same_school", "same_faculty", "same_year",
    "gpa_a", "gpa_b", "gpa_diff", "gpa_bucket_diff", "same_gpa_bucket",
    "distance_km", "log_distance",
    "common_interest_count", "interest_jaccard",
    "profile_completion_a", "profile_completion_b",
    "a_age_pref_match", "b_age_pref_match", "mutual_age_pref",
    "a_gpa_pref_match",
]


def load_config(config_path: str) -> dict:
    with open(config_path) as f:
        return yaml.safe_load(f)


def prepare_data(config: dict):
    """Load and split data using temporal split."""
    data_path = config.get("data_path", "data/synthetic/training_features.csv")

    if not os.path.exists(data_path):
        print("Training features not found. Building from synthetic data...")
        build_training_features(
            input_dir=config.get("raw_data_dir", "data/synthetic"),
            output_path=data_path,
        )

    df = pd.read_csv(data_path)

    # Temporal split (by created_at if available, else random)
    if "created_at" in df.columns:
        df["created_at"] = pd.to_datetime(df["created_at"])
        df = df.sort_values("created_at")

    # Build arrays only after sorting so features and labels retain temporal order.
    label_col = config.get("label", "liked")
    X = df[FEATURE_COLUMNS].values
    y = df[label_col].values
    viewers = df["viewer_id"].values if "viewer_id" in df.columns else None

    if "created_at" in df.columns:

        n = len(df)
        train_end = int(n * 0.7)
        val_end = int(n * 0.85)

        X_train, y_train = X[:train_end], y[:train_end]
        X_val, y_val = X[train_end:val_end], y[train_end:val_end]
        X_test, y_test = X[val_end:], y[val_end:]
        viewers_train = viewers[:train_end] if viewers is not None else None
        viewers_val = viewers[train_end:val_end] if viewers is not None else None
        viewers_test = viewers[val_end:] if viewers is not None else None
    else:
        from sklearn.model_selection import train_test_split
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=0.3, random_state=config.get("seed", 42),
        )
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp, test_size=0.5, random_state=config.get("seed", 42),
        )
        viewers_train, viewers_val, viewers_test = None, None, None

    print(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    print(f"Positive rate — Train: {y_train.mean():.2%}, Val: {y_val.mean():.2%}, Test: {y_test.mean():.2%}")

    return (X_train, y_train, X_val, y_val, X_test, y_test,
            viewers_train, viewers_val, viewers_test)


def train_logistic(X_train, y_train, config: dict):
    """Train Logistic Regression baseline."""
    model = LogisticRegression(
        C=config.get("C", 1.0),
        max_iter=config.get("max_iter", 1000),
        random_state=config.get("seed", 42),
    )
    model.fit(X_train, y_train)
    return model


def train_lightgbm(X_train, y_train, X_val, y_val, config: dict):
    """Train LightGBM classifier."""
    if not HAS_LIGHTGBM:
        raise ImportError("LightGBM not installed. pip install lightgbm")

    params = config.get("lgbm_params", {
        "objective": "binary",
        "metric": "binary_logloss",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "max_depth": 6,
        "min_child_samples": 20,
        "n_estimators": 500,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "random_state": config.get("seed", 42),
        "verbose": -1,
    })

    model = lgb.LGBMClassifier(**params)
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[lgb.early_stopping(50), lgb.log_evaluation(50)],
    )

    return model


def evaluate_model(model, X, y, model_name: str, viewer_ids=None) -> dict:
    """Compute classification and ranking metrics."""
    y_prob = model.predict_proba(X)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    metrics = {
        "model": model_name,
        "roc_auc": round(roc_auc_score(y, y_prob), 4),
        "pr_auc": round(average_precision_score(y, y_prob), 4),
        "log_loss": round(log_loss(y, y_prob), 4),
        "brier_score": round(brier_score_loss(y, y_prob), 4),
        "precision": round(precision_score(y, y_pred, zero_division=0), 4),
        "recall": round(recall_score(y, y_pred, zero_division=0), 4),
        "f1": round(f1_score(y, y_pred, zero_division=0), 4),
    }

    # Ranking metrics grouped by viewer when viewer ids are available
    ranking = compute_ranking_metrics(y, y_prob, k_values=[5, 10], viewer_ids=viewer_ids)
    metrics.update(ranking)

    return metrics


def save_model(model, metrics: dict, config: dict, version: str):
    """Save model, metrics, config, and feature schema."""
    output_dir = os.path.join("artifacts", version)
    os.makedirs(output_dir, exist_ok=True)

    # Model
    joblib.dump(model, os.path.join(output_dir, "model.pkl"))

    # Version
    with open(os.path.join(output_dir, "version.txt"), "w") as f:
        f.write(version)

    # Metrics
    with open(os.path.join(output_dir, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # Config
    with open(os.path.join(output_dir, "config.yaml"), "w") as f:
        yaml.dump(config, f)

    # Feature schema
    with open(os.path.join(output_dir, "feature_schema.json"), "w") as f:
        json.dump({"features": FEATURE_COLUMNS, "version": version}, f, indent=2)

    print(f"\nModel saved to {output_dir}/")

    # Symlink or copy as active model
    import shutil
    active_path = os.path.join("artifacts", "active_model")
    if os.path.islink(active_path):
        os.unlink(active_path)
    elif os.path.isdir(active_path):
        shutil.rmtree(active_path)
    elif os.path.exists(active_path):
        os.remove(active_path)

    try:
        os.symlink(os.path.abspath(output_dir), active_path)
        print(f"Active model symlinked: {active_path} → {output_dir}")
    except OSError:
        if os.path.exists(active_path):
            shutil.rmtree(active_path)
        shutil.copytree(output_dir, active_path)
        print(f"Active model copied: {active_path}")


def main():
    parser = argparse.ArgumentParser(description="FwP ML Training Pipeline")
    parser.add_argument("--config", type=str, default="configs/lightgbm.yaml")
    parser.add_argument("--model", type=str, choices=["logistic", "lightgbm"], default="lightgbm")
    args = parser.parse_args()

    # Load config
    if os.path.exists(args.config):
        config = load_config(args.config)
    else:
        config = {"seed": 42, "data_path": "data/synthetic/training_features.csv"}

    print(f"=== FwP ML Training Pipeline ===")
    print(f"Model: {args.model}")
    print(f"Config: {args.config}")
    print()

    # Prepare data
    (X_train, y_train, X_val, y_val, X_test, y_test,
     viewers_train, viewers_val, viewers_test) = prepare_data(config)

    # Train
    start_time = time.time()
    if args.model == "logistic":
        model = train_logistic(X_train, y_train, config)
        version = f"lr_v{datetime.now().strftime('%Y%m%d_%H%M')}"
    else:
        model = train_lightgbm(X_train, y_train, X_val, y_val, config)
        version = f"lgbm_v{datetime.now().strftime('%Y%m%d_%H%M')}"

    train_time = time.time() - start_time
    print(f"\nTraining time: {train_time:.1f}s")

    # Evaluate
    print("\n=== Validation Metrics ===")
    val_metrics = evaluate_model(model, X_val, y_val, f"{args.model}_val", viewers_val)
    for k, v in val_metrics.items():
        print(f"  {k}: {v}")

    print("\n=== Test Metrics ===")
    test_metrics = evaluate_model(model, X_test, y_test, f"{args.model}_test", viewers_test)
    for k, v in test_metrics.items():
        print(f"  {k}: {v}")

    # Feature importance (for tree models)
    if hasattr(model, "feature_importances_"):
        print("\n=== Feature Importance (top 10) ===")
        importances = list(zip(FEATURE_COLUMNS, model.feature_importances_))
        importances.sort(key=lambda x: x[1], reverse=True)
        for feat, imp in importances[:10]:
            print(f"  {feat}: {imp:.4f}")

    # Save
    all_metrics = {
        "validation": val_metrics,
        "test": test_metrics,
        "train_time_seconds": round(train_time, 1),
        "train_samples": len(X_train),
        "timestamp": datetime.now().isoformat(),
    }
    save_model(model, all_metrics, config, version)


if __name__ == "__main__":
    main()
