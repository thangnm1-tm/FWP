import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SwipeEvent, SwipeAction } from './entities/swipe-event.entity';
import { RecommendationImpression } from './entities/recommendation-impression.entity';
import { Match } from '../matches/entities/match.entity';
import { User } from '../users/entities/user.entity';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';

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
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly notifications: NotificationsService,
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
  ): Promise<{
    matched: boolean;
    matchId?: string;
    roomId?: string;
    peer?: { userId: string; displayName: string | null; avatarUrl: string | null; photos: string[] };
  }> {
    if (viewerId === candidateId) {
      throw new BadRequestException('Cannot swipe yourself');
    }

    const candidate = await this.dataSource.getRepository(User).findOne({
      where: { id: candidateId },
    });
    if (!candidate) {
      throw new NotFoundException('Candidate not found');
    }

    if (impressionId) {
      const impression = await this.impressionRepository.findOne({
        where: { id: impressionId, viewerUserId: viewerId, candidateUserId: candidateId },
      });
      if (!impression) {
        throw new BadRequestException('Impression does not belong to this feed card');
      }
    }

    // Check for existing swipe (fast dedup path)
    const existing = await this.swipeRepository.findOne({
      where: { viewerUserId: viewerId, candidateUserId: candidateId },
    });
    if (existing) {
      throw new ConflictException('Already swiped this user');
    }

    const [userLow, userHigh] =
      viewerId < candidateId ? [viewerId, candidateId] : [candidateId, viewerId];

    // Use transaction for atomicity
    let result: {
      matched: boolean;
      matchId?: string;
    };

    try {
      result = await this.dataSource.transaction(async (manager) => {
        // Serialize every swipe for an unordered user pair. This makes the
        // reciprocal-like check observe the other transaction after it commits,
        // preventing a missed match under concurrent likes.
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
          [userLow, userHigh],
        );

        // Re-check under the pair lock because the initial check can race.
        const existingInTransaction = await manager.findOne(SwipeEvent, {
          where: { viewerUserId: viewerId, candidateUserId: candidateId },
        });
        if (existingInTransaction) {
          throw new ConflictException('Already swiped this user');
        }

        // Insert swipe event. ON CONFLICT DO NOTHING makes the database
        // constraint a final race guard instead of surfacing raw 23505 errors.
        const insert = await manager.query(
          `INSERT INTO swipe_events
             (viewer_user_id, candidate_user_id, action, impression_id, session_id)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (viewer_user_id, candidate_user_id) DO NOTHING
           RETURNING id`,
          [
            viewerId,
            candidateId,
            action,
            impressionId || null,
            sessionId || null,
          ],
        );

        // A duplicate concurrent swipe: the pre-check raced, so treat as conflict.
        if (!insert || insert.length === 0) {
          throw new ConflictException('Already swiped this user');
        }

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
            // The pair lock above ensures this read sees any committed
            // reciprocal swipe before match creation.
            // Check if match already exists
            const existingMatch = await manager.findOne(Match, {
              where: { userAId: userLow, userBId: userHigh },
            });

            if (existingMatch) {
              // Match already created (e.g. the reciprocal swipe won the race).
              // Surface it only when it is active so both users converge.
              return existingMatch.active
                ? { matched: true, matchId: existingMatch.id }
                : { matched: false };
            }

            const match = manager.create(Match, {
              userAId: userLow,
              userBId: userHigh,
            });
            const saved = await manager.save(match);
            return { matched: true, matchId: saved.id };
          }
        }

        return { matched: false };
      });
    } catch (error: any) {
      if (
        error instanceof ConflictException ||
        error?.code === '23505' ||
        error?.message?.includes('23505') ||
        error?.message?.includes('duplicate key')
      ) {
        throw new ConflictException('Already swiped this user');
      }
      throw error;
    }
    if (result.matched && result.matchId) {
      // createChatRoom is idempotent; both racing swipes converge on one room.
      const room = await this.chatService.createChatRoom(result.matchId);
      const roomSummary = await this.chatService.getChatRoomSummary(room.id, viewerId);
      const matchEvent = { matchId: result.matchId, roomId: room.id, users: [viewerId, candidateId] };
      this.chatGateway.notifyUsers([viewerId, candidateId], 'match:new', matchEvent);
      await this.notifications.sendToUsers([viewerId, candidateId], { title: 'Bạn có một kết nối mới!', body: 'Hãy bắt đầu trò chuyện trên FwP.', data: { type: 'match', matchId: result.matchId, roomId: room.id } });
      return {
        ...result,
        roomId: room.id,
        peer: {
          userId: roomSummary.peerUserId,
          displayName: roomSummary.peerDisplayName,
          avatarUrl: roomSummary.peerAvatarUrl,
          photos: roomSummary.peerPhotos,
        },
      };
    }
    return result;
  }

  /**
   * Log recommendation impressions for ML tracking
   */
  async logImpressions(
    viewerId: string,
    requestId: string,
    modelVersion: string,
    candidates: { candidateId: string; score: number; rank: number }[],
  ): Promise<{ candidateId: string; impressionId: string }[]> {
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
    const saved = await this.impressionRepository.save(impressions);
    return saved.map((impression) => ({
      candidateId: impression.candidateUserId,
      impressionId: impression.id,
    }));
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
