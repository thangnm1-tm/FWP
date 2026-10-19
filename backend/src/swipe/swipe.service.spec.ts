import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SwipeService } from './swipe.service';
import { SwipeEvent, SwipeAction } from './entities/swipe-event.entity';
import { RecommendationImpression } from './entities/recommendation-impression.entity';
import { Match } from '../matches/entities/match.entity';
import { User } from '../users/entities/user.entity';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';

describe('SwipeService', () => {
  let service: SwipeService;
  let swipeRepo: { findOne: jest.Mock; find: jest.Mock };
  let impressionRepo: { findOne: jest.Mock };
  let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
  let chatService: { createChatRoom: jest.Mock; getChatRoomSummary: jest.Mock };
  let chatGateway: { notifyUsers: jest.Mock };
  let notifications: { sendToUsers: jest.Mock };

  beforeEach(async () => {
    swipeRepo = { findOne: jest.fn(), find: jest.fn() };
    impressionRepo = { findOne: jest.fn() };
    dataSource = { getRepository: jest.fn(), transaction: jest.fn() };
    chatService = { createChatRoom: jest.fn(), getChatRoomSummary: jest.fn() };
    chatGateway = { notifyUsers: jest.fn() };
    notifications = { sendToUsers: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SwipeService,
        { provide: getRepositoryToken(SwipeEvent), useValue: swipeRepo },
        { provide: getRepositoryToken(RecommendationImpression), useValue: impressionRepo },
        { provide: getRepositoryToken(Match), useValue: { findOne: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        { provide: ChatService, useValue: chatService },
        { provide: ChatGateway, useValue: chatGateway },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(SwipeService);
  });

  afterEach(() => jest.clearAllMocks());

  /**
   * Builds a DataSource.transaction mock whose manager exposes the operations
   * SwipeService uses: advisory-lock query, raw INSERT ... RETURNING, findOne
   * and save. `insertResult` is returned by the swipe INSERT call.
   */
  function mockTransaction(
    manager: Record<string, jest.Mock>,
    insertResult: unknown[] = [{ id: 'swipe-1' }],
  ) {
    const query = jest.fn();
    const lock = jest.fn().mockResolvedValue([]);
    const insert = jest.fn().mockResolvedValue(insertResult);
    query.mockImplementation((sql: string) => {
      if (/pg_advisory_xact_lock/i.test(sql)) return lock();
      return insert();
    });
    manager.query = query;
    dataSource.transaction.mockImplementation(
      async (cb: (m: unknown) => unknown) => cb(manager),
    );
  }

  it('rejects swiping yourself', async () => {
    await expect(
      service.swipe('user-1', 'user-1', SwipeAction.LIKE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the candidate does not exist', async () => {
    dataSource.getRepository.mockReturnValue({ findOne: jest.fn().mockResolvedValue(null) });
    await expect(
      service.swipe('user-1', 'user-2', SwipeAction.LIKE),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a swipe that was already recorded', async () => {
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({ id: 'candidate' }),
    });
    swipeRepo.findOne.mockResolvedValue({ id: 'existing-swipe' });

    await expect(
      service.swipe('user-1', 'user-2', SwipeAction.PASS),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('records a PASS without creating a match', async () => {
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({ id: 'candidate' }),
    });
    swipeRepo.findOne.mockResolvedValue(null);

    const save = jest.fn();
    mockTransaction({
      create: jest.fn().mockReturnValue({}),
      save,
      findOne: jest.fn(),
    });

    const result = await service.swipe('user-1', 'user-2', SwipeAction.PASS);

    expect(result).toEqual({ matched: false });
    expect(save).not.toHaveBeenCalled();
    expect(chatService.createChatRoom).not.toHaveBeenCalled();
  });

  it('creates a match on a reciprocal LIKE and notifies both users', async () => {
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({ id: 'candidate' }),
    });
    swipeRepo.findOne.mockResolvedValue(null);

    const save = jest.fn().mockResolvedValue({ id: 'match-1' });
    const managerFindOne = jest
      .fn()
      .mockResolvedValueOnce(null) // in-transaction dedup check: no existing swipe
      .mockResolvedValueOnce({ id: 'reciprocal-like' }) // reciprocal swipe
      .mockResolvedValueOnce(null); // no existing match

    mockTransaction({
      create: jest.fn().mockReturnValue({}),
      save,
      findOne: managerFindOne,
    });

    chatService.createChatRoom.mockResolvedValue({ id: 'room-1' });
    chatService.getChatRoomSummary.mockResolvedValue({
      peerUserId: 'user-2',
      peerDisplayName: 'Peer',
      peerAvatarUrl: 'avatar.png',
      peerPhotos: ['avatar.png'],
    });

    const result = await service.swipe('user-1', 'user-2', SwipeAction.LIKE);

    expect(result.matched).toBe(true);
    expect(result.matchId).toBe('match-1');
    expect(result.roomId).toBe('room-1');
    expect(chatGateway.notifyUsers).toHaveBeenCalledWith(
      ['user-1', 'user-2'],
      'match:new',
      expect.objectContaining({ matchId: 'match-1', roomId: 'room-1' }),
    );
    expect(notifications.sendToUsers).toHaveBeenCalledWith(
      ['user-1', 'user-2'],
      expect.objectContaining({ data: expect.objectContaining({ type: 'match' }) }),
    );
  });

  it('converges on an already-created active match instead of duplicating it', async () => {
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({ id: 'candidate' }),
    });
    swipeRepo.findOne.mockResolvedValue(null);

    const save = jest.fn();
    const managerFindOne = jest
      .fn()
      .mockResolvedValueOnce(null) // dedup
      .mockResolvedValueOnce({ id: 'reciprocal-like' })
      .mockResolvedValueOnce({ id: 'existing-match', active: true });

    mockTransaction({
      create: jest.fn().mockReturnValue({}),
      save,
      findOne: managerFindOne,
    });

    chatService.createChatRoom.mockResolvedValue({ id: 'room-1' });
    chatService.getChatRoomSummary.mockResolvedValue({
      peerUserId: 'user-2',
      peerDisplayName: 'Peer',
      peerAvatarUrl: null,
      peerPhotos: [],
    });

    const result = await service.swipe('user-1', 'user-2', SwipeAction.LIKE);

    expect(result.matched).toBe(true);
    expect(result.matchId).toBe('existing-match');
    expect(save).not.toHaveBeenCalled();
  });

  it('treats a lost duplicate-insert race as a conflict', async () => {
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({ id: 'candidate' }),
    });
    swipeRepo.findOne.mockResolvedValue(null);

    // ON CONFLICT DO NOTHING returns an empty set for a racing duplicate.
    mockTransaction(
      { create: jest.fn(), save: jest.fn(), findOne: jest.fn().mockResolvedValue(null) },
      [],
    );

    await expect(
      service.swipe('user-1', 'user-2', SwipeAction.LIKE),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an impression that does not belong to the viewer/candidate pair', async () => {
    dataSource.getRepository.mockReturnValue({
      findOne: jest.fn().mockResolvedValue({ id: 'candidate' }),
    });
    impressionRepo.findOne.mockResolvedValue(null);

    await expect(
      service.swipe('user-1', 'user-2', SwipeAction.LIKE, 'impression-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns the ids the viewer already swiped', async () => {
    swipeRepo.find.mockResolvedValue([
      { candidateUserId: 'a' },
      { candidateUserId: 'b' },
    ]);

    await expect(service.getSwipedUserIds('user-1')).resolves.toEqual(['a', 'b']);
  });
});
