"""
Feature Engineering for Training Pipeline
Builds features from raw synthetic/real data for model training.
Shared logic with serving/features.py to minimize training-serving skew.
"""

import os
import numpy as np
import pandas as pd


def build_training_features(
    input_dir: str = "data/synthetic",
    output_path: str = "data/synthetic/training_features.csv",
) -> pd.DataFrame:
    """
    Build feature table from raw data files.
    Input: users, profiles, user_interests, locations, swipe_events
    Output: feature table with one row per (viewer, candidate) swipe pair.
    """
    print(f"Building features from {input_dir}...")

    profiles = pd.read_csv(os.path.join(input_dir, "profiles.csv"))
    interests = pd.read_csv(os.path.join(input_dir, "user_interests.csv"))
    locations = pd.read_csv(os.path.join(input_dir, "locations.csv"))
    preferences = pd.read_csv(os.path.join(input_dir, "preferences.csv"))
    swipes = pd.read_csv(os.path.join(input_dir, "swipe_events.csv"))

    # Build interest sets
    interest_map = {}
    for uid, group in interests.groupby("user_id"):
        interest_map[uid] = set(group["interest_name"].tolist())

    # Build profile/location/preference lookups
    profile_map = profiles.set_index("user_id").to_dict("index")
    loc_map = locations.set_index("user_id").to_dict("index")
    pref_map = preferences.set_index("user_id").to_dict("index")

    # Build features for each swipe event
    rows = []
    for _, swipe in swipes.iterrows():
        viewer_id = swipe["viewer_user_id"]
        cand_id = swipe["candidate_user_id"]

        viewer = profile_map.get(viewer_id, {})
        cand = profile_map.get(cand_id, {})
        viewer_loc = loc_map.get(viewer_id, {})
        cand_loc = loc_map.get(cand_id, {})
        viewer_interests = interest_map.get(viewer_id, set())
        cand_interests = interest_map.get(cand_id, set())
        viewer_pref = pref_map.get(viewer_id, {})
        cand_pref = pref_map.get(cand_id, {})

        # Age
        age_a = viewer.get("academic_year", 1) + 17  # approximate
        age_b = cand.get("academic_year", 1) + 17
        age_diff = abs(age_a - age_b)

        # School
        same_school = float(viewer.get("university_id") == cand.get("university_id"))
        same_faculty = float(viewer.get("faculty_code") == cand.get("faculty_code"))
        same_year = float(viewer.get("academic_year") == cand.get("academic_year"))

        # GPA
        gpa_a = viewer.get("gpa", 0)
        gpa_b = cand.get("gpa", 0)
        gpa_diff = abs(gpa_a - gpa_b)
        bucket_a = viewer.get("gpa_bucket", 0)
        bucket_b = cand.get("gpa_bucket", 0)
        gpa_bucket_diff = abs(bucket_a - bucket_b)
        same_gpa_bucket = float(bucket_a == bucket_b)

        # Distance
        if viewer_loc and cand_loc:
            lat_diff = viewer_loc.get("latitude", 0) - cand_loc.get("latitude", 0)
            lng_diff = viewer_loc.get("longitude", 0) - cand_loc.get("longitude", 0)
            distance_km = np.sqrt(lat_diff ** 2 + lng_diff ** 2) * 111
        else:
            distance_km = 50.0
        log_distance = np.log1p(distance_km)

        # Interests
        intersection = len(viewer_interests & cand_interests)
        union = len(viewer_interests | cand_interests)
        interest_jaccard = intersection / union if union > 0 else 0

        # Profile completion
        completion_a = float(viewer.get("profile_completed", False))
        completion_b = float(cand.get("profile_completed", False))

        # Preference compatibility
        a_age_pref = 1.0 if viewer_pref.get("min_age", 18) <= age_b <= viewer_pref.get("max_age", 30) else 0.0
        b_age_pref = 1.0 if cand_pref.get("min_age", 18) <= age_a <= cand_pref.get("max_age", 30) else 0.0
        mutual_age_pref = float(a_age_pref > 0 and b_age_pref > 0)
        a_gpa_pref = 1.0 if viewer_pref.get("gpa_preference", "no_preference") == "no_preference" else 0.5

        # Label
        liked = 1 if swipe["action"] == "LIKE" else 0

        rows.append({
            "viewer_id": viewer_id,
            "candidate_id": cand_id,
            "age_a": age_a, "age_b": age_b, "age_diff": age_diff,
            "same_school": same_school, "same_faculty": same_faculty, "same_year": same_year,
            "gpa_a": gpa_a, "gpa_b": gpa_b, "gpa_diff": round(gpa_diff, 4),
            "gpa_bucket_diff": gpa_bucket_diff, "same_gpa_bucket": same_gpa_bucket,
            "distance_km": round(distance_km, 4), "log_distance": round(log_distance, 4),
            "common_interest_count": intersection, "interest_jaccard": round(interest_jaccard, 4),
            "profile_completion_a": completion_a, "profile_completion_b": completion_b,
            "a_age_pref_match": a_age_pref, "b_age_pref_match": b_age_pref,
            "mutual_age_pref": mutual_age_pref, "a_gpa_pref_match": a_gpa_pref,
            "liked": liked,
            "created_at": swipe.get("created_at", ""),
        })

    df = pd.DataFrame(rows)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Feature table saved: {output_path} ({len(df)} rows)")
    print(f"Positive rate: {df['liked'].mean():.2%}")

    return df


if __name__ == "__main__":
    build_training_features()
