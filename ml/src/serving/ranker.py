"""
Heuristic Ranker — Rule-based fallback when ML model is unavailable.
score = 0.25 * interest_sim + 0.25 * distance_score + 0.20 * gpa_sim + 0.15 * age_sim + 0.15 * same_school
"""

import numpy as np
import logging

logger = logging.getLogger("fwp-ml.ranker")


class HeuristicRanker:
    """
    Rule-based ranking as Model 0 / fallback.
    Does NOT use ML. Serves as baseline for comparison.
    """

    def score_batch(
        self,
        viewer_id: str,
        candidate_ids: list[str],
    ) -> np.ndarray:
        """
        Generate heuristic scores for candidates.
        In production this would query DB for features.
        Uses a stable hash of the viewer and candidate IDs when pair features
        are unavailable, preserving deterministic ordering across requests.
        """
        # Keep this deterministic until feature construction is available.
        import hashlib
        return np.array([
            0.1 + 0.8 * (
                int(hashlib.sha256(f"{viewer_id}:{candidate_id}".encode()).hexdigest()[:16], 16)
                / float(16 ** 16 - 1)
            )
            for candidate_id in candidate_ids
        ], dtype=np.float32)

    def score_with_features(self, features: np.ndarray) -> np.ndarray:
        """
        Heuristic scoring using pre-computed features.

        Feature indices (matching FeatureBuilder.FEATURE_COLUMNS):
        0: age_a, 1: age_b, 2: age_diff
        3: same_school, 4: same_faculty, 5: same_year
        6: gpa_a, 7: gpa_b, 8: gpa_diff, 9: gpa_bucket_diff, 10: same_gpa_bucket
        11: distance_km, 12: log_distance
        13: common_interest_count, 14: interest_jaccard
        15: profile_completion_a, 16: profile_completion_b
        17: a_age_pref_match, 18: b_age_pref_match, 19: mutual_age_pref
        20: a_gpa_pref_match
        """
        scores = np.zeros(features.shape[0])

        # Interest similarity (0.25)
        scores += 0.25 * features[:, 14]  # interest_jaccard

        # Distance score (0.25) — closer is better
        max_dist = 100.0
        dist_score = np.clip(1.0 - features[:, 11] / max_dist, 0, 1)
        scores += 0.25 * dist_score

        # GPA similarity (0.20)
        gpa_sim = np.clip(1.0 - features[:, 8] / 4.0, 0, 1)  # gpa_diff
        scores += 0.20 * gpa_sim

        # Age similarity (0.15)
        age_sim = np.clip(1.0 - features[:, 2] / 10.0, 0, 1)  # age_diff
        scores += 0.15 * age_sim

        # Same school bonus (0.15)
        scores += 0.15 * features[:, 3]  # same_school

        return scores
