"""
Synthetic Data Generator for FwP
Generates fake users, profiles, interests, swipe events for pipeline testing.

WARNING: Synthetic data is ONLY for testing pipeline, API, and infrastructure.
Do NOT use results from synthetic data to claim causal relationships
(e.g., "GPA similarity increases match rate") — this would be circular reasoning.
"""

import random
import uuid
from datetime import date, timedelta
from typing import Optional

import numpy as np
import pandas as pd


# ── Constants ──

UNIVERSITIES = [
    {"id": "ptit", "name": "Học viện Công nghệ Bưu chính Viễn thông", "short": "PTIT", "domain": "stu.ptit.edu.vn"},
]

FACULTIES = [
    {"code": "CNTT", "name": "Công nghệ thông tin"},
    {"code": "ATTT", "name": "An toàn thông tin"},
    {"code": "DTVT", "name": "Điện tử Viễn thông"},
    {"code": "QTKD", "name": "Quản trị kinh doanh"},
    {"code": "KTT", "name": "Kế toán"},
    {"code": "MMT", "name": "Mạng máy tính"},
    {"code": "KHMT", "name": "Khoa học máy tính"},
    {"code": "KTPM", "name": "Kỹ thuật phần mềm"},
]

INTERESTS = [
    "AI/ML", "Web Dev", "Mobile Dev", "Game Dev", "Cybersecurity",
    "Guitar", "Piano", "Singing", "Dancing", "Photography",
    "Gym", "Running", "Swimming", "Basketball", "Football",
    "Anime", "Manga", "Movies", "K-pop", "Reading",
    "Coffee", "Cooking", "Travel", "Hiking", "Gaming",
    "Art", "Design", "Music Production", "Volunteering", "Debate",
]

GENDERS = ["male", "female"]
PURPOSES = ["dating", "friendship", "study_buddy", "all"]


def generate_users(n: int = 1000, seed: int = 42) -> dict:
    """
    Generate synthetic FwP dataset.
    Returns dict with DataFrames: users, profiles, interests, preferences, locations, swipe_events.
    """
    rng = np.random.default_rng(seed)
    random.seed(seed)

    user_ids = [str(uuid.uuid4()) for _ in range(n)]

    # ── Users ──
    users = pd.DataFrame({
        "user_id": user_ids,
        "email": [f"b{21 + i % 5}dccn{str(i).zfill(3)}@stu.ptit.edu.vn" for i in range(n)],
        "status": "active",
    })

    # ── Profiles ──
    genders = rng.choice(GENDERS, n, p=[0.55, 0.45])
    ages = rng.integers(18, 26, n)
    dobs = [date.today() - timedelta(days=int(age * 365.25)) for age in ages]
    gpas = np.clip(rng.normal(2.8, 0.6, n), 0, 4.0).round(2)
    gpa_buckets = np.where(gpas >= 3.6, 3, np.where(gpas >= 3.2, 2, np.where(gpas >= 2.5, 1, 0)))
    faculties = rng.choice(len(FACULTIES), n)
    years = rng.integers(1, 5, n)

    profiles = pd.DataFrame({
        "user_id": user_ids,
        "display_name": [f"User_{i}" for i in range(n)],
        "date_of_birth": dobs,
        "gender": genders,
        "bio": [f"Sinh viên {FACULTIES[f]['name']} năm {y}, thích {random.choice(INTERESTS)}"
                for f, y in zip(faculties, years)],
        "gpa": gpas,
        "gpa_bucket": gpa_buckets,
        "university_id": "ptit",
        "faculty_code": [FACULTIES[f]["code"] for f in faculties],
        "academic_year": years,
        "purpose": rng.choice(PURPOSES, n),
        "profile_completed": True,
    })

    # ── User Interests ──
    interest_rows = []
    for uid in user_ids:
        n_interests = rng.integers(3, 10)
        selected = random.sample(INTERESTS, min(n_interests, len(INTERESTS)))
        for interest_name in selected:
            interest_rows.append({"user_id": uid, "interest_name": interest_name})
    user_interests = pd.DataFrame(interest_rows)

    # ── Preferences ──
    preferences = pd.DataFrame({
        "user_id": user_ids,
        "gender_preference": [
            "female" if g == "male" else "male" if g == "female" else "all"
            for g in genders
        ],
        "min_age": 18,
        "max_age": 28,
        "max_distance_km": rng.choice([5, 10, 20, 50], n),
        "gpa_preference": rng.choice(["no_preference", "same_tier", "max_1_diff"], n, p=[0.6, 0.15, 0.25]),
    })

    # ── Locations (Hanoi area) ──
    lat_center, lng_center = 21.0285, 105.8542
    locations = pd.DataFrame({
        "user_id": user_ids,
        "latitude": lat_center + rng.normal(0, 0.02, n),
        "longitude": lng_center + rng.normal(0, 0.02, n),
    })

    # ── Swipe Events ──
    swipe_events = _generate_swipe_events(
        user_ids, profiles, user_interests, locations, rng, n_swipes_per_user=30,
    )

    return {
        "users": users,
        "profiles": profiles,
        "user_interests": user_interests,
        "preferences": preferences,
        "locations": locations,
        "swipe_events": swipe_events,
    }


def _generate_swipe_events(
    user_ids: list,
    profiles: pd.DataFrame,
    user_interests: pd.DataFrame,
    locations: pd.DataFrame,
    rng: np.random.Generator,
    n_swipes_per_user: int = 30,
) -> pd.DataFrame:
    """
    Generate synthetic swipe events.
    NOTE: This uses heuristic rules — results should NOT be used to
    make causal claims about feature importance.
    """
    # Build interest sets for Jaccard
    interest_map = {}
    for uid, group in user_interests.groupby("user_id"):
        interest_map[uid] = set(group["interest_name"].tolist())

    # Build profile lookup
    profile_map = profiles.set_index("user_id").to_dict("index")
    loc_map = locations.set_index("user_id").to_dict("index")

    swipes = []
    for viewer_id in user_ids:
        viewer = profile_map.get(viewer_id, {})
        viewer_interests = interest_map.get(viewer_id, set())

        # Sample candidates
        candidates = random.sample(
            [uid for uid in user_ids if uid != viewer_id],
            min(n_swipes_per_user, len(user_ids) - 1),
        )

        for cand_id in candidates:
            cand = profile_map.get(cand_id, {})
            cand_interests = interest_map.get(cand_id, set())

            # Compute like probability based on features
            # (This is for data generation ONLY — documented as synthetic)
            p_like = 0.2  # base rate

            # Interest similarity
            if viewer_interests and cand_interests:
                jaccard = len(viewer_interests & cand_interests) / len(viewer_interests | cand_interests)
                p_like += 0.15 * jaccard

            # Distance
            if viewer_id in loc_map and cand_id in loc_map:
                dist = np.sqrt(
                    (loc_map[viewer_id]["latitude"] - loc_map[cand_id]["latitude"]) ** 2
                    + (loc_map[viewer_id]["longitude"] - loc_map[cand_id]["longitude"]) ** 2
                ) * 111  # approximate km
                p_like += 0.1 * max(0, 1 - dist / 20)

            # Same faculty bonus
            if viewer.get("faculty_code") == cand.get("faculty_code"):
                p_like += 0.05

            # GPA (small effect — NOT dominant)
            gpa_diff = abs(viewer.get("gpa", 0) - cand.get("gpa", 0))
            p_like += 0.03 * max(0, 1 - gpa_diff / 2)

            p_like = min(0.7, max(0.05, p_like))

            action = "LIKE" if rng.random() < p_like else "PASS"
            swipes.append({
                "viewer_user_id": viewer_id,
                "candidate_user_id": cand_id,
                "action": action,
                "created_at": date.today() - timedelta(days=int(rng.integers(0, 90))),
            })

    return pd.DataFrame(swipes)


if __name__ == "__main__":
    print("Generating synthetic FwP data...")
    data = generate_users(n=1000, seed=42)
    
    output_dir = "data/synthetic"
    import os
    os.makedirs(output_dir, exist_ok=True)
    
    for name, df in data.items():
        path = os.path.join(output_dir, f"{name}.csv")
        df.to_csv(path, index=False)
        print(f"  {name}: {len(df)} rows -> {path}")
    
    # Quick stats
    swipes = data["swipe_events"]
    like_rate = (swipes["action"] == "LIKE").mean()
    print(f"\nSwipe stats: {len(swipes)} total, like_rate={like_rate:.2%}")
    
    # Check mutual matches
    likes = swipes[swipes["action"] == "LIKE"]
    pairs = set()
    for _, row in likes.iterrows():
        pair = tuple(sorted([row["viewer_user_id"], row["candidate_user_id"]]))
        if pair in pairs:
            continue
        reverse = likes[
            (likes["viewer_user_id"] == row["candidate_user_id"])
            & (likes["candidate_user_id"] == row["viewer_user_id"])
        ]
        if len(reverse) > 0:
            pairs.add(pair)
    print(f"Mutual matches: {len(pairs)}")
