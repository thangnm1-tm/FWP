import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ) {}

  async getUserMatches(userId: string): Promise<Match[]> {
    return this.matchRepository.find({
      where: [
        { userAId: userId, active: true },
        { userBId: userId, active: true },
      ],
      order: { matchedAt: 'DESC' },
    });
  }

  async getMatchedUserIds(userId: string): Promise<string[]> {
    const matches = await this.getUserMatches(userId);
    return matches.map((m) =>
      m.userAId === userId ? m.userBId : m.userAId,
    );
  }

  async findMatch(userAId: string, userBId: string): Promise<Match | null> {
    const [low, high] = userAId < userBId ? [userAId, userBId] : [userBId, userAId];
    return this.matchRepository.findOne({
      where: { userAId: low, userBId: high },
    });
  }

  async unmatch(matchId: string, userId: string): Promise<void> {
    const match = await this.matchRepository.findOne({ where: { id: matchId } });
    if (!match) return;
    if (match.userAId !== userId && match.userBId !== userId) return;
    await this.matchRepository.update(matchId, { active: false });
  }
}
