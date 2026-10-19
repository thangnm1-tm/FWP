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
  Block,
  Report,
} from './entities/chat.entities';
import { Match } from '../matches/entities/match.entity';
import { ProfilesService } from '../profiles/profiles.service';

export interface ChatRoomSummary {
  id: string;
  matchId: string;
  createdAt: Date;
  peerUserId: string;
  peerDisplayName: string | null;
  peerAvatarUrl: string | null;
  peerPhotos: string[];
  lastMessage: string | null;
}

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatRoom)
    private readonly chatRoomRepository: Repository<ChatRoom>,

    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,

    @InjectRepository(Block)
    private readonly blockRepository: Repository<Block>,

    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,

    private readonly profilesService: ProfilesService,
  ) {}

  // ─── Chat Room ───

  async createChatRoom(matchId: string): Promise<ChatRoom> {
    const match = await this.matchRepository.findOne({ where: { id: matchId, active: true } });
    if (!match) throw new NotFoundException('Active match not found');
    const existing = await this.getChatRoomByMatch(matchId);
    if (existing) return existing;

    try {
      await this.chatRoomRepository
        .createQueryBuilder()
        .insert()
        .into(ChatRoom)
        .values({ matchId })
        .onConflict('("match_id") DO NOTHING')
        .execute();
    } catch (error: any) {
      if (error?.code !== '23505') throw error;
    }

    const room = await this.getChatRoomByMatch(matchId);
    if (!room) throw new NotFoundException('Chat room could not be created');
    return room;
  }

  async getChatRoomByMatch(matchId: string): Promise<ChatRoom | null> {
    return this.chatRoomRepository.findOne({ where: { matchId } });
  }

  async getUserChatRooms(userId: string): Promise<ChatRoomSummary[]> {
    const matches = await this.matchRepository.find({
      where: [
        { userAId: userId, active: true },
        { userBId: userId, active: true },
      ],
    });

    const matchIds = matches.map((m) => m.id);
    if (matchIds.length === 0) return [];

    const rooms = await this.chatRoomRepository
      .createQueryBuilder('room')
      .where('room.matchId IN (:...matchIds)', { matchIds })
      .leftJoinAndSelect('room.match', 'match')
      .orderBy('room.createdAt', 'DESC')
      .getMany();

    const peerIds = rooms.map((room) => this.getPeerId(room, userId));
    const profiles = await this.profilesService.getChatProfiles([...new Set(peerIds)]);
    const profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
    const latestMessages = await this.messageRepository
      .createQueryBuilder('message')
      .distinctOn(['message.chatRoomId'])
      .where('message.chatRoomId IN (:...roomIds)', { roomIds: rooms.map((room) => room.id) })
      .orderBy('message.chatRoomId', 'ASC')
      .addOrderBy('message.createdAt', 'DESC')
      .getMany();
    const lastMessagesByRoomId = new Map(latestMessages.map((message) => [message.chatRoomId, message.content]));
    return rooms.map((room) => this.presentRoom(
      room,
      userId,
      profilesByUserId.get(this.getPeerId(room, userId)),
      lastMessagesByRoomId.get(room.id) ?? null,
    ));
  }

  async getChatRoomSummary(chatRoomId: string, userId: string): Promise<ChatRoomSummary> {
    const room = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
      relations: ['match'],
    });
    if (!room) throw new NotFoundException('Chat room not found');
    await this.verifyChatAccess(chatRoomId, userId);
    const peerId = this.getPeerId(room, userId);
    const profile = (await this.profilesService.getChatProfiles([peerId]))[0];
    const latestMessage = await this.messageRepository.findOne({
      where: { chatRoomId },
      order: { createdAt: 'DESC' },
      select: ['content'],
    });
    return this.presentRoom(room, userId, profile, latestMessage?.content ?? null);
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

  // ─── Block & Report ───

  async blockUser(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const existing = await this.blockRepository.findOne({
      where: { blockerId, blockedId },
    });
    if (existing) {
      return;
    }

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
    if (reporterId === reportedId) {
      throw new BadRequestException('Cannot report yourself');
    }

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

  private getPeerId(room: ChatRoom, userId: string): string {
    const match = room.match;
    if (!match || (match.userAId !== userId && match.userBId !== userId)) {
      throw new ForbiddenException('Not a member of this chat');
    }
    return match.userAId === userId ? match.userBId : match.userAId;
  }

  private presentRoom(
    room: ChatRoom,
    userId: string,
    profile?: { userId: string; displayName: string | null; photos: string[] },
    lastMessage: string | null = null,
  ): ChatRoomSummary {
    const peerUserId = this.getPeerId(room, userId);
    const peerPhotos = profile?.photos ?? [];
    return {
      id: room.id,
      matchId: room.matchId,
      createdAt: room.createdAt,
      peerUserId,
      peerDisplayName: profile?.displayName ?? null,
      peerAvatarUrl: peerPhotos[0] ?? null,
      peerPhotos,
      lastMessage,
    };
  }

  async assertChatAccess(chatRoomId: string, userId: string): Promise<void> {
    return this.verifyChatAccess(chatRoomId, userId);
  }

  async getOtherMemberId(chatRoomId: string, userId: string): Promise<string> {
    const room = await this.chatRoomRepository.findOne({ where: { id: chatRoomId }, relations: ['match'] });
    if (!room) throw new NotFoundException('Chat room not found');
    await this.verifyChatAccess(chatRoomId, userId);
    return room.match.userAId === userId ? room.match.userBId : room.match.userAId;
  }
}
