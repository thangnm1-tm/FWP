"""Export production interaction tables to the same raw CSV contract as synthetic data."""
from __future__ import annotations

import os
from pathlib import Path
import pandas as pd
from sqlalchemy import create_engine, text


def database_url() -> str:
    return os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://{user}:{password}@{host}:{port}/{database}".format(
            user=os.getenv("POSTGRES_USER", "fwp_user"), password=os.getenv("POSTGRES_PASSWORD", "fwp_password_change_me"),
            host=os.getenv("POSTGRES_HOST", "localhost"), port=os.getenv("POSTGRES_PORT", "5432"), database=os.getenv("POSTGRES_DB", "fwp_db"),
        ),
    )


def export_training_data(output_dir: str, min_events: int = 100) -> int:
    """Export swipes plus the profile context needed by feature construction.

    Only swipes that originated from an impression are used; this avoids treating
    arbitrary actions as recommendation feedback and preserves shown_at ordering.
    """
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    engine = create_engine(database_url())
    queries = {
        "profiles.csv": "SELECT p.user_id, p.date_of_birth, p.university_id, f.code AS faculty_code, p.academic_year, p.gpa, p.gpa_bucket, p.profile_completed FROM profiles p LEFT JOIN faculties f ON f.id = p.faculty_id WHERE p.profile_completed = true AND p.date_of_birth IS NOT NULL",
        "user_interests.csv": "SELECT ui.user_id, i.name AS interest_name FROM user_interests ui JOIN interests i ON i.id = ui.interest_id",
        "locations.csv": "SELECT user_id, latitude, longitude FROM user_locations",
        "preferences.csv": "SELECT user_id, min_age, max_age, gpa_preference FROM preferences",
        "swipe_events.csv": """
          SELECT se.viewer_user_id, se.candidate_user_id, se.action, se.created_at,
                 ri.shown_at, ri.rank_position, ri.model_version, ri.score
          FROM swipe_events se JOIN recommendation_impressions ri ON ri.id = se.impression_id
          ORDER BY se.created_at ASC
        """,
    }
    with engine.connect() as conn:
        for filename, query in queries.items():
            pd.read_sql(text(query), conn).to_csv(output / filename, index=False)
    profiles = pd.read_csv(output / "profiles.csv")
    if "date_of_birth" not in profiles or profiles["date_of_birth"].isna().any():
        missing = int(profiles["date_of_birth"].isna().sum()) if "date_of_birth" in profiles else len(profiles)
        raise ValueError(f"Production profile data contains {missing} missing date_of_birth values")
    events = pd.read_csv(output / "swipe_events.csv")
    if len(events) < min_events:
        raise ValueError(f"Need at least {min_events} impression-backed swipe events; found {len(events)}")
    return len(events)
