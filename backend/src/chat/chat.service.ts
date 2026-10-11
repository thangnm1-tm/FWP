import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChatRoom,
  Message,
  RevealRequest,
  RevealStatus,
  Block,
  Report,
} from './entities/chat.entities';
import { Match } from '../matches/entities/match.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly chatRoomRepository: Repository<ChatRoom>,

    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,

    @InjectRepository(RevealRequest)
    private readonly revealRepository: Repository<RevealRequest>,

    @InjectRepository(Block)
    private readonly blockRepository: Repository<Block>,

    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
  ) {}

  // ─── Chat Room ───

  async createChatRoom(matchId: string): Promise<ChatRoom> {
    const room = this.chatRoomRepository.create({ matchId });
    return this.chatRoomRepository.save(room);
  }

  async getChatRoomByMatch(matchId: string): Promise<ChatRoom | null> {
    return this.chatRoomRepository.findOne({ where: { matchId } });
  }

  async getUserChatRooms(userId: string): Promise<ChatRoom[]> {
    const matches = await this.matchRepository.find({
      where: [
        { userAId: userId, active: true },
        { userBId: userId, active: true },
      ],
    });

    const matchIds = matches.map((m) => m.id);
    if (matchIds.length === 0) return [];

    return this.chatRoomRepository
      .createQueryBuilder('room')
      .where('room.match_id IN (:...matchIds)', { matchIds })
      .leftJoinAndSelect('room.match', 'match')
      .getMany();
  }

  // ─── Messages ───

  async sendMessage(
    chatRoomId: string,
    senderId: string,
    content: string,
  ): Promise<Message> {
    // Verify sender is part of this chat
    await this.verifyChatAccess(chatRoomId, senderId);

    const message = this.messageRepository.create({
      chatRoomId,
      senderId,
      content,
    });
    return this.messageRepository.save(message);
  }

  async getMessages(
    chatRoomId: string,
    userId: string,
    limit = 50,
    before?: Date,
  ): Promise<Message[]> {
    await this.verifyChatAccess(chatRoomId, userId);

    const qb = this.messageRepository
      .createQueryBuilder('msg')
      .where('msg.chat_room_id = :chatRoomId', { chatRoomId })
      .orderBy('msg.created_at', 'DESC')
      .take(limit);

    if (before) {
      qb.andWhere('msg.created_at < :before', { before });
    }

    return qb.getMany();
  }

  // ─── Reveal ───

  async requestReveal(matchId: string, requesterId: string): Promise<RevealRequest> {
    const match = await this.matchRepository.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');

    if (match.userAId !== requesterId && match.userBId !== requesterId) {
      throw new ForbiddenException('Not part of this match');
    }

    let reveal = await this.revealRepository.findOne({ where: { matchId } });

    if (!reveal) {
      // First request
      const isUserA = match.userAId === requesterId;
      reveal = this.revealRepository.create({
        matchId,
        requesterId,
        status: isUserA ? RevealStatus.A_REQUESTED : RevealStatus.B_REQUESTED,
      });
      return this.revealRepository.save(reveal);
    }

    // Second user accepting
    if (reveal.requesterId === requesterId) {
      throw new BadRequestException('You already requested reveal');
    }

    if (
      reveal.status === RevealStatus.A_REQUESTED ||
      reveal.status === RevealStatus.B_REQUESTED
    ) {
      reveal.status = RevealStatus.BOTH_ACCEPTED;
      reveal.respondedAt = new Date();
      await this.revealRepository.save(reveal);

      // Update chat room
      await this.chatRoomRepository.update(
        { matchId },
        { identityRevealed: true },
      );

      return reveal;
    }

    throw new BadRequestException('Reveal already processed');
  }

  async declineReveal(matchId: string, userId: string): Promise<RevealRequest> {
    const reveal = await this.revealRepository.findOne({ where: { matchId } });
    if (!reveal) throw new NotFoundException('No reveal request found');

    if (reveal.requesterId === userId) {
      throw new BadRequestException('Cannot decline your own request');
    }

    reveal.status = RevealStatus.DECLINED;
    reveal.respondedAt = new Date();
    return this.revealRepository.save(reveal);
  }

  // ─── Block & Report ───

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    const block = this.blockRepository.create({ blockerId, blockedId });
    await this.blockRepository.save(block);

    // Deactivate any match between them
    const [userLow, userHigh] =
      blockerId < blockedId ? [blockerId, blockedId] : [blockedId, blockerId];
    await this.matchRepository.update(
      { userAId: userLow, userBId: userHigh },
      { active: false },
    );
  }

  async reportUser(
    reporterId: string,
    reportedId: string,
    reason: string,
    description?: string,
  ): Promise<Report> {
    const report = this.reportRepository.create({
      reporterId,
      reportedId,
      reason,
      description: description || null,
    });
    return this.reportRepository.save(report);
  }

  async getBlockedUserIds(userId: string): Promise<string[]> {
    const blocks = await this.blockRepository.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });
    return blocks.map((b) =>
      b.blockerId === userId ? b.blockedId : b.blockerId,
    );
  }

  // ─── Private ───

  private async verifyChatAccess(
    chatRoomId: string,
    userId: string,
  ): Promise<void> {
    const room = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
      relations: ['match'],
    });

    if (!room) throw new NotFoundException('Chat room not found');

    const match = room.match;
    if (match.userAId !== userId && match.userBId !== userId) {
      throw new ForbiddenException('Not a member of this chat');
    }

    if (!match.active) {
      throw new ForbiddenException('Match is no longer active');
    }
  }
}
