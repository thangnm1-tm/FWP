# FwP ML System Design

## Problem Formulation

### MVP: Pointwise Binary Classification — P(A likes B)

- **Input**: Feature vector (viewer A, candidate B, pair features)
- **Output**: P(A likes B) ∈ [0, 1]
- **Label**: 1 = LIKED, 0 = PASSED
- **Training unit**: Each impression that was swiped
- **Inference unit**: Batch (viewer, [candidates])

### Two-way scoring

Train 1 model, run it twice:
```
p_ab = model.predict(features(A → B))
p_ba = model.predict(features(B → A))
score(A,B) = sqrt(p_ab × p_ba)
```

## Feature Schema (21 features)

| # | Feature | Type | Source |
|---|---------|------|--------|
| 1 | age_a | float | profiles |
| 2 | age_b | float | profiles |
| 3 | age_diff | float | computed |
| 4 | same_school | binary | profiles |
| 5 | same_faculty | binary | profiles |
| 6 | same_year | binary | profiles |
| 7 | gpa_a | float | profiles |
| 8 | gpa_b | float | profiles |
| 9 | gpa_diff | float | computed |
| 10 | gpa_bucket_diff | int | computed |
| 11 | same_gpa_bucket | binary | computed |
| 12 | distance_km | float | PostGIS |
| 13 | log_distance | float | computed |
| 14 | common_interest_count | int | user_interests |
| 15 | interest_jaccard | float | computed |
| 16 | profile_completion_a | float | profiles |
| 17 | profile_completion_b | float | profiles |
| 18 | a_age_pref_match | binary | preferences |
| 19 | b_age_pref_match | binary | preferences |
| 20 | mutual_age_pref | binary | computed |
| 21 | a_gpa_pref_match | float | preferences |

## Leakage Audit

All features use data available **before** prediction timestamp.
No future match/message/reveal data is used as features.

| Feature | Leakage Risk | Status |
|---------|-------------|--------|
| Behavioral (like_rate) | ⚠️ Must use historical only | Phase 2+ |
| All profile features | ✅ None | Safe |
| All pair features | ✅ None | Safe |
| All preference features | ✅ None | Safe |

## Experiment Plan

| Exp | Model | Dataset | Metric |
|-----|-------|---------|--------|
| E0 | Random | Any | Lower bound |
| E1 | Rule heuristic | Synthetic | NDCG@10 baseline |
| E2 | Logistic Regression | Synthetic + Speed Dating | PR-AUC, NDCG@10 |
| E3 | LightGBM | Synthetic + Speed Dating | PR-AUC, NDCG@10 |
| E4 | LambdaMART | Real FwP data | NDCG@10, MRR |
| E5 | Two-Tower | Real FwP data (future) | Recall@500 |

## Synthetic Data Warning

> Synthetic data generator uses heuristic rules (e.g., interest similarity → higher like probability).
> Any model trained on this data will "discover" these rules — this is circular reasoning.
> Results from synthetic data should ONLY validate that the pipeline works correctly.
> Causal claims require real user data.
