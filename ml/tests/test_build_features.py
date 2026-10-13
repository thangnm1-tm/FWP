import pandas as pd
from src.features.build_features import build_training_features


def test_feature_pipeline_builds_expected_schema(tmp_path):
    raw = tmp_path / "raw"
    raw.mkdir()
    pd.DataFrame([{"user_id": "a", "university_id": "ptit", "faculty_code": "it", "academic_year": 2, "gpa": 3.2, "gpa_bucket": 3, "profile_completed": True}, {"user_id": "b", "university_id": "ptit", "faculty_code": "it", "academic_year": 3, "gpa": 3.5, "gpa_bucket": 3, "profile_completed": True}]).to_csv(raw / "profiles.csv", index=False)
    pd.DataFrame([{"user_id": "a", "interest_name": "AI"}, {"user_id": "b", "interest_name": "AI"}]).to_csv(raw / "user_interests.csv", index=False)
    pd.DataFrame([{"user_id": "a", "latitude": 21.0, "longitude": 105.0}, {"user_id": "b", "latitude": 21.01, "longitude": 105.01}]).to_csv(raw / "locations.csv", index=False)
    pd.DataFrame([{"user_id": "a", "min_age": 18, "max_age": 25, "gpa_preference": "no_preference"}, {"user_id": "b", "min_age": 18, "max_age": 25, "gpa_preference": "no_preference"}]).to_csv(raw / "preferences.csv", index=False)
    pd.DataFrame([{"viewer_user_id": "a", "candidate_user_id": "b", "action": "LIKE", "created_at": "2026-01-01"}]).to_csv(raw / "swipe_events.csv", index=False)
    result = build_training_features(str(raw), str(tmp_path / "features.csv"))
    assert len(result) == 1
    assert result.loc[0, "liked"] == 1
    assert result.loc[0, "common_interest_count"] == 1
    assert {"interest_jaccard", "mutual_age_pref", "distance_km"}.issubset(result.columns)
