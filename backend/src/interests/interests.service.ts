import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Interest } from './entities/interest.entity';
import { UserInterest } from './entities/user-interest.entity';

@Injectable()
export class InterestsService {
  constructor(
    @InjectRepository(Interest)
    private readonly interestRepository: Repository<Interest>,

    @InjectRepository(UserInterest)
    private readonly userInterestRepository: Repository<UserInterest>,
  ) {}

  async findAll(): Promise<Interest[]> {
    return this.interestRepository.find({ order: { category: 'ASC', name: 'ASC' } });
  }

  async getUserInterests(userId: string): Promise<Interest[]> {
    const userInterests = await this.userInterestRepository.find({
      where: { userId },
      relations: ['interest'],
    });
    return userInterests.map((ui) => ui.interest);
  }

  async getUserInterestIds(userId: string): Promise<string[]> {
    const userInterests = await this.userInterestRepository.find({
      where: { userId },
    });
    return userInterests.map((ui) => ui.interestId);
  }

  async setUserInterests(
    userId: string,
    interestIds: string[],
  ): Promise<Interest[]> {
    // Remove existing interests
    await this.userInterestRepository.delete({ userId });

    // Add new interests (max 20)
    const limitedIds = interestIds.slice(0, 20);
    const userInterests = limitedIds.map((interestId) =>
      this.userInterestRepository.create({ userId, interestId }),
    );
    await this.userInterestRepository.save(userInterests);

    return this.getUserInterests(userId);
  }

  /**
   * Calculate Jaccard similarity between two users' interests
   */
  async calculateJaccard(userIdA: string, userIdB: string): Promise<number> {
    const [interestsA, interestsB] = await Promise.all([
      this.getUserInterestIds(userIdA),
      this.getUserInterestIds(userIdB),
    ]);

    const setA = new Set(interestsA);
    const setB = new Set(interestsB);

    const intersection = [...setA].filter((id) => setB.has(id)).length;
    const union = new Set([...setA, ...setB]).size;

    if (union === 0) return 0;
    return intersection / union;
  }
}
