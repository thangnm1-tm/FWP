"""
Evaluation Metrics for FwP ML
Includes both classification and ranking metrics.
"""

import numpy as np
from sklearn.metrics import ndcg_score


def compute_ranking_metrics(
    y_true: np.ndarray,
    y_scores: np.ndarray,
    k_values: list[int] = [5, 10],
) -> dict:
    """
    Compute ranking metrics: NDCG@K, Precision@K, Recall@K, MRR.

    For proper ranking evaluation, data should be grouped by viewer.
    This simplified version treats the entire test set as one ranking.
    """
    metrics = {}

    # Sort by predicted score descending
    sorted_indices = np.argsort(-y_scores)
    y_true_sorted = y_true[sorted_indices]

    for k in k_values:
        top_k = y_true_sorted[:k]
        total_relevant = y_true.sum()

        # Precision@K
        precision_k = top_k.sum() / k if k > 0 else 0
        metrics[f"precision_at_{k}"] = round(float(precision_k), 4)

        # Recall@K
        recall_k = top_k.sum() / total_relevant if total_relevant > 0 else 0
        metrics[f"recall_at_{k}"] = round(float(recall_k), 4)

        # NDCG@K
        try:
            ndcg = ndcg_score(
                y_true.reshape(1, -1),
                y_scores.reshape(1, -1),
                k=k,
            )
            metrics[f"ndcg_at_{k}"] = round(float(ndcg), 4)
        except Exception:
            metrics[f"ndcg_at_{k}"] = 0.0

    # MRR (Mean Reciprocal Rank)
    mrr = 0.0
    for i, label in enumerate(y_true_sorted):
        if label == 1:
            mrr = 1.0 / (i + 1)
            break
    metrics["mrr"] = round(mrr, 4)

    return metrics


def format_metrics_table(experiment_results: list[dict]) -> str:
    """Format experiment results as a comparison table."""
    if not experiment_results:
        return "No results"

    headers = list(experiment_results[0].keys())
    rows = [[str(r.get(h, "")) for h in headers] for r in experiment_results]

    col_widths = [max(len(h), max(len(r[i]) for r in rows)) for i, h in enumerate(headers)]
    header_line = " | ".join(h.ljust(w) for h, w in zip(headers, col_widths))
    separator = "-+-".join("-" * w for w in col_widths)

    table_rows = [" | ".join(r[i].ljust(col_widths[i]) for i in range(len(headers))) for r in rows]

    return f"{header_line}\n{separator}\n" + "\n".join(table_rows)
