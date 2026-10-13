import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SwipeService } from '../swipe/swipe.service';
import { ChatService } from '../chat/chat.service';
import { MatchesService } from '../matches/matches.service';

interface RankedCandidate {
  candidateId: string;
  score: number;
  rank: number;
  distanceKm?: number;
  impressionId?: string;
  displayName?: string;
  age?: number;
  bio?: string;
  photos?: string[];
  interests?: string[];
  faculty?: string;
  university?: string;
  gpaBucket?: number | null;
}

interface MlRankResponse {
  model_version: string;
  results: { candidate_id: string; score: number }[];
  inference_ms: number;
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);
  private readonly mlServiceUrl: string;
  private readonly mlTimeout: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly swipeService: SwipeService,
    private readonly chatService: ChatService,
    private readonly matchesService: MatchesService,
  ) {
    this.mlServiceUrl = this.configService.get('ML_SERVICE_URL', 'http://localhost:8000');
    this.mlTimeout = this.configService.get<number>('ML_SERVICE_TIMEOUT', 3000);
  }

  /**
   * Main recommendation pipeline:
   * 1. Candidate Generation (SQL + PostGIS)
   * 2. ML Ranking (FastAPI) with fallback
   * 3. Business Re-ranking + Exploration
   * 4. Log impressions
   */
  async getRecommendations(
    viewerId: string,
    limit = 20,
  ): Promise<{ requestId: string; modelVersion: string; candidates: RankedCandidate[] }> {
    const requestId = uuidv4();

    // ── Step 1: Candidate Generation ──
    const candidates = await this.generateCandidates(viewerId);

    if (candidates.length === 0) {
      return { requestId, modelVersion: 'none', candidates: [] };
    }

    // ── Step 2: ML Ranking (with fallback) ──
    let ranked: RankedCandidate[];
    let modelVersion: string;

    try {
      const mlResult = await this.callMlService(viewerId, candidates);
      ranked = mlResult.results.map((r, i) => ({
        candidateId: r.candidate_id,
        score: r.score,
        rank: i + 1,
        distanceKm: candidates.find((c) => c.userId === r.candidate_id)?.distanceKm,
      }));
      modelVersion = mlResult.model_version;
    } catch (error) {
      this.logger.warn(`ML service unavailable, using fallback: ${error}`);
      ranked = this.fallbackRanking(candidates);
      modelVersion = 'rule_v1_fallback';
    }

    // ── Step 3: Business Re-ranking + Exploration ──
    ranked = this.applyBusinessRules(ranked);
    ranked = this.applyExploration(ranked, candidates);

    // Take top-K
    const topK = ranked.slice(0, limit);

    // ── Step 4: Log impressions ──
    const impressions = await this.swipeService.logImpressions(
      viewerId,
      requestId,
      modelVersion,
      topK.map((c) => ({
        candidateId: c.candidateId,
        score: c.score,
        rank: c.rank,
      })),
    );

    const publicProfiles = await this.loadPublicCards(topK.map((c) => c.candidateId));
    const impressionByCandidate = new Map(impressions.map((i) => [i.candidateId, i.impressionId]));
    const profileByCandidate = new Map(publicProfiles.map((p) => [p.candidateId, p]));
    for (const candidate of topK) {
      candidate.impressionId = impressionByCandidate.get(candidate.candidateId);
      Object.assign(candidate, profileByCandidate.get(candidate.candidateId));
    }

    return { requestId, modelVersion, candidates: topK };
  }

  /** Return only fields intended for the public swipe card; never expose email or DOB. */
  private async loadPublicCards(candidateIds: string[]): Promise<Partial<RankedCandidate>[]> {
    if (!candidateIds.length) return [];
    return this.dataSource.query(
      `SELECT p.user_id AS "candidateId", p.display_name AS "displayName",
        CASE WHEN p.date_of_birth IS NULL THEN NULL
          ELSE EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth))::int END AS age,
        p.bio, p.photos,
        f.name AS faculty, un.short_name AS university,
        COALESCE(array_agg(DISTINCT i.name) FILTER (WHERE i.name IS NOT NULL), '{}') AS interests
       FROM profiles p
       LEFT JOIN faculties f ON f.id = p.faculty_id
       LEFT JOIN universities un ON un.id = p.university_id
       LEFT JOIN user_interests ui ON ui.user_id = p.user_id
       LEFT JOIN interests i ON i.id = ui.interest_id
       WHERE p.user_id = ANY($1::uuid[]) AND p.discoverable = TRUE
       GROUP BY p.user_id, p.display_name, p.date_of_birth, p.bio, p.photos,
         f.name, un.short_name`,
      [candidateIds],
    );
  }

  /**
   * Candidate Generation using PostgreSQL + PostGIS
   * Filters: active, profile complete, gender, age, distance, not blocked, not swiped, not matched
   */
  private async generateCandidates(
    viewerId: string,
  ): Promise<{ userId: string; distanceKm: number }[]> {
    // Get viewer's data
    const viewerData = await this.dataSource.query(
      `SELECT
         p.gender, p.date_of_birth, p.gpa_bucket, p.university_id,
         pr.gender_preference, pr.min_age, pr.max_age, pr.max_distance_km,
         pr.gpa_preference, pr.max_gpa_tier_diff, pr.same_university_only,
         ul.point
       FROM profiles p
       LEFT JOIN preferences pr ON pr.user_id = p.user_id
       LEFT JOIN user_locations ul ON ul.user_id = p.user_id
       WHERE p.user_id = $1`,
      [viewerId],
    );

    if (viewerData.length === 0) return [];
    const viewer = viewerData[0];

    // Get blocked and already-swiped user IDs
    const [blockedIds, swipedIds, matchedIds] = await Promise.all([
      this.chatService.getBlockedUserIds(viewerId),
      this.swipeService.getSwipedUserIds(viewerId),
      this.matchesService.getMatchedUserIds(viewerId),
    ]);

    const excludeIds = [...new Set([viewerId, ...blockedIds, ...swipedIds, ...matchedIds])];

    // Build candidate query
    let query = `
      SELECT
        p.user_id AS "userId",
        CASE
          WHEN ul_viewer.point IS NOT NULL AND ul_cand.point IS NOT NULL
          THEN ST_Distance(ul_viewer.point, ul_cand.point) / 1000.0
          ELSE 999
        END AS "distanceKm"
      FROM profiles p
      INNER JOIN users u ON u.id = p.user_id
      LEFT JOIN user_locations ul_cand ON ul_cand.user_id = p.user_id
      LEFT JOIN user_locations ul_viewer ON ul_viewer.user_id = $1
      WHERE u.status = 'active'
        AND p.profile_completed = true
        AND p.date_of_birth <= CURRENT_DATE - INTERVAL '18 years'
        AND p.discoverable = true
        AND p.user_id != $1
    `;

    const params: any[] = [viewerId];
    let paramIndex = 2;

    // Exclude already interacted users
    if (excludeIds.length > 1) {
      query += ` AND p.user_id NOT IN (${excludeIds.map((_, i) => `$${paramIndex + i}`).join(',')})`;
      params.push(...excludeIds);
      paramIndex += excludeIds.length;
    }

    // Gender preference filter
    if (viewer.gender_preference && viewer.gender_preference !== 'all') {
      query += ` AND p.gender = $${paramIndex}`;
      params.push(viewer.gender_preference);
      paramIndex++;
    }

    // Age filter
    if (viewer.min_age && viewer.max_age) {
      query += ` AND EXTRACT(YEAR FROM AGE(p.date_of_birth)) BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(viewer.min_age, viewer.max_age);
      paramIndex += 2;
    }

    // Distance filter (PostGIS)
    const maxDistance = viewer.max_distance_km || 20;
    if (viewer.point) {
      query += ` AND (ul_cand.point IS NULL OR ST_DWithin(ul_viewer.point, ul_cand.point, $${paramIndex}))`;
      params.push(maxDistance * 1000); // meters
      paramIndex++;
    }

    // GPA constraint (only if user enabled it)
    if (viewer.gpa_preference === 'same_tier' && viewer.gpa_bucket !== null) {
      query += ` AND p.gpa_bucket = $${paramIndex}`;
      params.push(viewer.gpa_bucket);
      paramIndex++;
    } else if (viewer.gpa_preference === 'max_1_diff' && viewer.gpa_bucket !== null) {
      query += ` AND ABS(p.gpa_bucket - $${paramIndex}) <= $${paramIndex + 1}`;
      params.push(viewer.gpa_bucket, viewer.max_gpa_tier_diff || 1);
      paramIndex += 2;
    }

    // Same university filter
    if (viewer.same_university_only && viewer.university_id) {
      query += ` AND p.university_id = $${paramIndex}`;
      params.push(viewer.university_id);
      paramIndex++;
    }

    // Limit candidates
    query += ` ORDER BY "distanceKm" ASC LIMIT 500`;

    return this.dataSource.query(query, params);
  }

  /**
   * Call FastAPI ML ranking service
   */
  private async callMlService(
    viewerId: string,
    candidates: { userId: string }[],
  ): Promise<MlRankResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.mlTimeout);

    try {
      const response = await fetch(`${this.mlServiceUrl}/v1/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          viewer_id: viewerId,
          candidate_ids: candidates.map((c) => c.userId),
          request_id: uuidv4(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`ML service returned ${response.status}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Fallback: Rule-based heuristic ranking
   * score = 0.25*interest_sim + 0.25*distance_score + 0.20*gpa_sim + 0.15*age_sim + 0.15*same_school
   */
  private fallbackRanking(
    candidates: { userId: string; distanceKm: number }[],
  ): RankedCandidate[] {
    // Simple distance-based ranking as fallback
    const sorted = [...candidates].sort((a, b) => a.distanceKm - b.distanceKm);

    return sorted.map((c, i) => ({
      candidateId: c.userId,
      score: Math.max(0, 1 - c.distanceKm / 100), // Simple distance score
      rank: i + 1,
      distanceKm: c.distanceKm,
    }));
  }

  /**
   * Business re-ranking rules
   */
  private applyBusinessRules(ranked: RankedCandidate[]): RankedCandidate[] {
    // Placeholder for boosting new users, capping popular users, etc.
    // For now, keep ML ranking order
    return ranked;
  }

  /**
   * Exploration: 90% exploitation, 10% random from remaining pool
   */
  private applyExploration(
    ranked: RankedCandidate[],
    allCandidates: { userId: string; distanceKm: number }[],
  ): RankedCandidate[] {
    if (ranked.length <= 5) return ranked;

    const explorationCount = Math.max(1, Math.floor(ranked.length * 0.1));
    const exploitCount = ranked.length - explorationCount;

    const exploit = ranked.slice(0, exploitCount);

    // Pick random candidates not in top exploit set
    const exploitIds = new Set(exploit.map((c) => c.candidateId));
    const explorationPool = allCandidates.filter(
      (c) => !exploitIds.has(c.userId),
    );

    const exploration: RankedCandidate[] = [];
    for (let i = 0; i < explorationCount && explorationPool.length > 0; i++) {
      const randomIdx = Math.floor(Math.random() * explorationPool.length);
      const picked = explorationPool.splice(randomIdx, 1)[0];
      exploration.push({
        candidateId: picked.userId,
        score: 0,
        rank: exploitCount + i + 1,
        distanceKm: picked.distanceKm,
      });
    }

    return [...exploit, ...exploration];
  }
}
