import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SwipeEvent, SwipeAction } from './entities/swipe-event.entity';
import { RecommendationImpression } from './entities/recommendation-impression.entity';
import { Match } from '../matches/entities/match.entity';

@Injectable()
export class SwipeService {
  constructor(
    @InjectRepository(SwipeEvent)
    private readonly swipeRepository: Repository<SwipeEvent>,

    @InjectRepository(RecommendationImpression)
    private readonly impressionRepository: Repository<RecommendationImpression>,

    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,

    private readonly dataSource: DataSource,
  ) {}

  /**
   * Process a swipe action.
   * If both users LIKED each other, create a match (with race condition protection).
   */
  async swipe(
    viewerId: string,
    candidateId: string,
    action: SwipeAction,
    impressionId?: string,
    sessionId?: string,
  ): Promise<{ matched: boolean; matchId?: string }> {
    if (viewerId === candidateId) {
      throw new BadRequestException('Cannot swipe yourself');
    }

    // Check for existing swipe (dedup)
    const existing = await this.swipeRepository.findOne({
      where: { viewerUserId: viewerId, candidateUserId: candidateId },
    });
    if (existing) {
      throw new ConflictException('Already swiped this user');
    }

    // Use transaction for atomicity
    return this.dataSource.transaction(async (manager) => {
      // Insert swipe event
      const swipe = manager.create(SwipeEvent, {
        viewerUserId: viewerId,
        candidateUserId: candidateId,
        action,
        impressionId: impressionId || null,
        sessionId: sessionId || null,
      });
      await manager.save(swipe);

      // Check for mutual like → create match
      if (action === SwipeAction.LIKE) {
        const reciprocalLike = await manager.findOne(SwipeEvent, {
          where: {
            viewerUserId: candidateId,
            candidateUserId: viewerId,
            action: SwipeAction.LIKE,
          },
        });

        if (reciprocalLike) {
          // Create match with ordered IDs to prevent duplicates
          const [userLow, userHigh] =
            viewerId < candidateId
              ? [viewerId, candidateId]
              : [candidateId, viewerId];

          // Check if match already exists
          const existingMatch = await manager.findOne(Match, {
            where: { userAId: userLow, userBId: userHigh },
          });

          if (!existingMatch) {
            const match = manager.create(Match, {
              userAId: userLow,
              userBId: userHigh,
            });
            const saved = await manager.save(match);
            return { matched: true, matchId: saved.id };
          }
        }
      }

      return { matched: false };
    });
  }

  /**
   * Log recommendation impressions for ML tracking
   */
  async logImpressions(
    viewerId: string,
    requestId: string,
    modelVersion: string,
    candidates: { candidateId: string; score: number; rank: number }[],
  ): Promise<void> {
    const impressions = candidates.map((c) =>
      this.impressionRepository.create({
        viewerUserId: viewerId,
        candidateUserId: c.candidateId,
        requestId,
        rankPosition: c.rank,
        modelVersion,
        score: c.score,
      }),
    );
    await this.impressionRepository.save(impressions);
  }

  /**
   * Get users that the viewer has already swiped (for filtering candidates)
   */
  async getSwipedUserIds(viewerId: string): Promise<string[]> {
    const swipes = await this.swipeRepository.find({
      where: { viewerUserId: viewerId },
      select: ['candidateUserId'],
    });
    return swipes.map((s) => s.candidateUserId);
  }
}
