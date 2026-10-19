"""
Feature Builder for ML Ranking
Builds pair features (viewer, candidate) for model scoring.
"""

import os
import logging
from typing import Optional

import numpy as np
import pandas as pd
from sqlalchemy import create_engine, text

logger = logging.getLogger("fwp-ml.features")


def get_db_url() -> str:
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    user = os.environ.get("POSTGRES_USER", "fwp_user")
    password = os.environ.get("POSTGRES_PASSWORD", "fwp_password_change_me")
    db = os.environ.get("POSTGRES_DB", "fwp_db")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"



class FeatureBuilder:
    """
    Builds feature vectors for (viewer, candidate) pairs.

    Feature groups:
    A. Viewer features
    B. Candidate features
    C. Pair features (age_diff, same_school, gpa_diff, interest_jaccard, etc.)
    D. Preference compatibility
    """

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

    def __init__(self):
        try:
            self.engine = create_engine(get_db_url(), pool_size=5)
            logger.info("FeatureBuilder connected to database")
        except Exception as e:
            logger.warning(f"FeatureBuilder DB connection failed: {e}")
            self.engine = None

    def build_batch_features(
        self,
        viewer_id: str,
        candidate_ids: list[str],
    ) -> Optional[np.ndarray]:
        """Build feature matrix for viewer vs all candidates."""
        if self.engine is None:
            return None

        try:
            with self.engine.connect() as conn:
                # Get viewer profile
                viewer = self._get_user_profile(conn, viewer_id)
                if viewer is None:
                    return None

                # Get viewer interests
                viewer_interests = self._get_user_interests(conn, viewer_id)

                # Get viewer preferences
                viewer_prefs = self._get_user_preferences(conn, viewer_id)

                features_list = []
                for cand_id in candidate_ids:
                    cand = self._get_user_profile(conn, cand_id)
                    if cand is None:
                        features_list.append(self._zero_features())
                        continue

                    cand_interests = self._get_user_interests(conn, cand_id)
                    cand_prefs = self._get_user_preferences(conn, cand_id)
                    distance = self._get_distance(conn, viewer_id, cand_id)

                    features = self._compute_pair_features(
                        viewer, cand,
                        viewer_interests, cand_interests,
                        viewer_prefs, cand_prefs,
                        distance,
                    )
                    features_list.append(features)

                return np.array(features_list, dtype=np.float32)

        except Exception as e:
            logger.error(f"Feature building error: {e}")
            return None

    def _get_user_profile(self, conn, user_id: str) -> Optional[dict]:
        result = conn.execute(
            text("""
                SELECT p.user_id, p.date_of_birth, p.gender, p.gpa, p.gpa_bucket,
                       p.university_id, p.faculty_id, f.code AS faculty_code,
                       p.academic_year,
                       profile_completed, bio
                FROM profiles p LEFT JOIN faculties f ON f.id = p.faculty_id
                WHERE p.user_id = :uid
            """),
            {"uid": user_id},
        )
        row = result.mappings().fetchone()
        return dict(row) if row else None

    def _get_user_interests(self, conn, user_id: str) -> set:
        result = conn.execute(
            text("""
                SELECT i.name
                FROM user_interests ui JOIN interests i ON i.id = ui.interest_id
                WHERE ui.user_id = :uid
            """),
            {"uid": user_id},
        )
        return {str(row[0]) for row in result}

    def _get_user_preferences(self, conn, user_id: str) -> Optional[dict]:
        result = conn.execute(
            text("SELECT * FROM preferences WHERE user_id = :uid"),
            {"uid": user_id},
        )
        row = result.mappings().fetchone()
        return dict(row) if row else None

    def _get_distance(self, conn, uid_a: str, uid_b: str) -> float:
        result = conn.execute(
            text("""
                SELECT ST_Distance(a.point, b.point) / 1000.0 AS dist
                FROM user_locations a, user_locations b
                WHERE a.user_id = :a AND b.user_id = :b
            """),
            {"a": uid_a, "b": uid_b},
        )
        row = result.fetchone()
        return float(row[0]) if row and row[0] is not None else 50.0

    def _compute_pair_features(
        self,
        viewer: dict, candidate: dict,
        viewer_interests: set, cand_interests: set,
        viewer_prefs: Optional[dict], cand_prefs: Optional[dict],
        distance_km: float,
    ) -> list[float]:
        """Compute feature vector for a (viewer, candidate) pair."""
        from datetime import date

        # Age features
        age_a = self._calc_age(viewer.get("date_of_birth"))
        age_b = self._calc_age(candidate.get("date_of_birth"))
        age_diff = abs(age_a - age_b) if age_a is not None and age_b is not None else 0

        # School features
        same_school = float(viewer.get("university_id") == candidate.get("university_id")
                           and viewer.get("university_id") is not None)
        same_faculty = float(viewer.get("faculty_code") == candidate.get("faculty_code")
                            and viewer.get("faculty_code") is not None)
        same_year = float(viewer.get("academic_year") == candidate.get("academic_year")
                         and viewer.get("academic_year") is not None)

        # GPA features
        gpa_a = viewer.get("gpa") or 0.0
        gpa_b = candidate.get("gpa") or 0.0
        gpa_diff = abs(gpa_a - gpa_b)
        bucket_a = viewer.get("gpa_bucket") or 0
        bucket_b = candidate.get("gpa_bucket") or 0
        gpa_bucket_diff = abs(bucket_a - bucket_b)
        same_gpa_bucket = float(bucket_a == bucket_b)

        # Distance features
        log_distance = float(np.log1p(distance_km))

        # Interest features
        intersection = len(viewer_interests & cand_interests)
        union = len(viewer_interests | cand_interests)
        interest_jaccard = intersection / union if union > 0 else 0.0

        # Profile completion
        completion_a = float(viewer.get("profile_completed", False))
        completion_b = float(candidate.get("profile_completed", False))

        # Preference compatibility
        a_age_pref = self._check_age_pref(viewer_prefs, age_b)
        b_age_pref = self._check_age_pref(cand_prefs, age_a)
        mutual_age_pref = float(a_age_pref > 0 and b_age_pref > 0)
        a_gpa_pref = self._check_gpa_pref(viewer_prefs, bucket_b)

        return [
            float(age_a or 20), float(age_b or 20), float(age_diff),
            same_school, same_faculty, same_year,
            float(gpa_a), float(gpa_b), float(gpa_diff),
            float(gpa_bucket_diff), same_gpa_bucket,
            float(distance_km), log_distance,
            float(intersection), float(interest_jaccard),
            completion_a, completion_b,
            float(a_age_pref), float(b_age_pref), mutual_age_pref,
            float(a_gpa_pref),
        ]

    def _calc_age(self, dob) -> Optional[float]:
        if dob is None:
            return None
        from datetime import date
        today = date.today()
        if hasattr(dob, 'year'):
            return float(today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day)))
        return None

    def _check_age_pref(self, prefs: dict, age: Optional[float]) -> float:
        if not prefs or age is None:
            return 0.5
        min_age = prefs.get("min_age", 18)
        max_age = prefs.get("max_age", 30)
        if min_age is None or max_age is None or pd.isna(min_age) or pd.isna(max_age):
            return 0.5
        return 1.0 if min_age <= age <= max_age else 0.0

    def _check_gpa_pref(self, prefs: Optional[dict], cand_bucket: int) -> float:
        if not prefs:
            return 0.5
        gpa_pref = prefs.get("gpa_preference", "no_preference")
        if gpa_pref is None or pd.isna(gpa_pref):
            return 0.5
        if gpa_pref == "no_preference":
            return 0.5
        # Hard constraint already handled in candidate generation
        return 1.0

    def _zero_features(self) -> list[float]:
        return [0.0] * len(self.FEATURE_COLUMNS)
