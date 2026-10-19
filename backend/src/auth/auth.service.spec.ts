import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserStatus } from '../users/entities/user.entity';
import { MailerService } from '../mailer/mailer.service';
import { DataSource } from 'typeorm';
import { StudentVerification } from '../users/entities/student-verification.entity';
import { User } from '../users/entities/user.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<Partial<UsersService>>;
  let jwt: { signAsync: jest.Mock; verify: jest.Mock };
  let mailer: jest.Mocked<Partial<MailerService>>;
  let dataSource: { transaction: jest.Mock };

  const allowedDomainUser = {
    id: 'user-1',
    email: 'b21dccn001@stu.ptit.edu.vn',
    passwordHash: 'hashed',
    status: UserStatus.PENDING,
  };

  beforeEach(async () => {
    users = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      createUser: jest.fn(),
      findLatestVerification: jest.fn(),
      createVerification: jest.fn(),
      incrementVerificationAttempts: jest.fn(),
      markVerified: jest.fn(),
      activateUser: jest.fn(),
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-token'),
      verify: jest.fn(),
    };
    mailer = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    dataSource = { transaction: jest.fn() };
    dataSource.transaction.mockImplementation(
      async (callback: (manager: Record<string, jest.Mock>) => unknown) =>
        callback({
          findOne: jest.fn().mockImplementation((entity) =>
            entity === User ? allowedDomainUser : null,
          ),
          increment: jest.fn().mockResolvedValue(undefined),
          update: jest.fn().mockResolvedValue(undefined),
          create: jest.fn().mockImplementation((_entity, value) => value),
          save: jest.fn().mockResolvedValue(undefined),
        }),
    );

    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'ALLOWED_EMAIL_DOMAINS') return 'stu.ptit.edu.vn';
        if (key === 'OTP_DELIVERY_MODE') return 'demo';
        if (key === 'DEMO_OTP') return '123456';
        return fallback;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: MailerService, useValue: mailer },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('rejects email outside the allowed student domains', async () => {
      await expect(
        service.register({ email: 'someone@gmail.com', password: 'password123' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.createUser).not.toHaveBeenCalled();
    });

    it('creates a pending user and issues an OTP for a valid domain', async () => {
      (users.findByEmail as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      (users.createUser as jest.Mock).mockResolvedValue(allowedDomainUser);

      const result = await service.register({
        email: 'B21DCCN001@Stu.Ptit.Edu.VN',
        password: 'password123',
      });

      expect(users.createUser).toHaveBeenCalledWith(
        'b21dccn001@stu.ptit.edu.vn',
        'hashed-pw',
      );
      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mailer.sendOtp).toHaveBeenCalledWith(
        'b21dccn001@stu.ptit.edu.vn',
        '123456',
      );
      expect(result.userId).toBe('user-1');
      expect((result as { devOtp?: string }).devOtp).toBe('123456');
    });

    it('rejects a duplicate, active email', async () => {
      (users.findByEmail as jest.Mock).mockResolvedValue({
        ...allowedDomainUser,
        status: UserStatus.ACTIVE,
      });

      await expect(
        service.register({ email: 'b21dccn001@stu.ptit.edu.vn', password: 'password123' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      (users.findByEmail as jest.Mock).mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@stu.ptit.edu.vn', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      (users.findByEmail as jest.Mock).mockResolvedValue(allowedDomainUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(
        service.login({ email: 'b21dccn001@stu.ptit.edu.vn', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('blocks login while the account is still pending verification', async () => {
      (users.findByEmail as jest.Mock).mockResolvedValue(allowedDomainUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      await expect(
        service.login({ email: 'b21dccn001@stu.ptit.edu.vn', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('returns tokens for valid credentials', async () => {
      (users.findByEmail as jest.Mock).mockResolvedValue({
        ...allowedDomainUser,
        status: UserStatus.ACTIVE,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'b21dccn001@stu.ptit.edu.vn',
        password: 'password123',
      });

      expect(result.tokenType).toBe('Bearer');
      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
    });
  });

  describe('refreshToken', () => {
    it('rejects an invalid refresh token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('bad token');
      });
      await expect(service.refreshToken('bad')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('verifyOtp', () => {
    /**
     * Wires the transaction manager for a verify attempt. The manager findOne
     * resolves the pending user and the active OTP challenge in call order, so
     * the attempt counter and verification updates can be asserted.
     */
    function mockVerifyTransaction(overrides: {
      user?: unknown;
      verification?: unknown;
    }) {
      const increment = jest.fn().mockResolvedValue(undefined);
      const update = jest.fn().mockResolvedValue(undefined);
      const findOne = jest
        .fn()
        .mockImplementation((entity) =>
          entity === User
            ? Promise.resolve(overrides.user ?? allowedDomainUser)
            : Promise.resolve(overrides.verification ?? null),
        );
      dataSource.transaction.mockImplementation(
        async (callback: (manager: Record<string, jest.Mock>) => unknown) =>
          callback({ findOne, increment, update }),
      );
      return { findOne, increment, update };
    }

    it('rejects an unknown user id without revealing it does not exist', async () => {
      mockVerifyTransaction({ user: null });
      await expect(
        service.verifyOtp('missing-user', { otpCode: '123456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(users.findByEmail).not.toHaveBeenCalled();
    });

    it('enforces the attempt limit before accepting a valid code', async () => {
      const { increment } = mockVerifyTransaction({
        verification: {
          id: 'verification-1',
          attempts: 5,
          otpCode: '123456',
          otpExpiresAt: new Date(Date.now() + 60_000),
        },
      });

      await expect(
        service.verifyOtp('user-1', { otpCode: '123456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(increment).not.toHaveBeenCalled();
    });

    it('increments attempts on an invalid code so it counts toward the limit', async () => {
      const { increment, update } = mockVerifyTransaction({
        verification: {
          id: 'verification-1',
          attempts: 1,
          otpCode: '123456',
          otpExpiresAt: new Date(Date.now() + 60_000),
        },
      });

      await expect(
        service.verifyOtp('user-1', { otpCode: '999999' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(increment).toHaveBeenCalledWith(
        StudentVerification,
        { id: 'verification-1' },
        'attempts',
        1,
      );
      expect(update).not.toHaveBeenCalled();
    });

    it('activates the user and issues tokens for a valid, unexpired code', async () => {
      const { update } = mockVerifyTransaction({
        verification: {
          id: 'verification-1',
          attempts: 0,
          otpCode: '123456',
          otpExpiresAt: new Date(Date.now() + 60_000),
        },
      });

      const result = await service.verifyOtp('user-1', { otpCode: '123456' });

      expect(update).toHaveBeenCalledWith(
        User,
        'user-1',
        { status: UserStatus.ACTIVE },
      );
      expect(result.accessToken).toBe('signed-token');
    });
  });

  describe('resendOtp', () => {
    it('rejects an unknown user id without revealing it does not exist', async () => {
      (users.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.resendOtp('missing-user')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects resend for an already verified account', async () => {
      (users.findById as jest.Mock).mockResolvedValue({
        ...allowedDomainUser,
        status: UserStatus.ACTIVE,
      });
      await expect(service.resendOtp('user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('enforces the resend cooldown for a recently issued OTP', async () => {
      (users.findById as jest.Mock).mockResolvedValue(allowedDomainUser);
      dataSource.transaction.mockImplementation(
        async (callback: (manager: Record<string, jest.Mock>) => unknown) =>
          callback({
            findOne: jest.fn().mockImplementation((entity) =>
              entity === User
                ? Promise.resolve(allowedDomainUser)
                : Promise.resolve({
                    id: 'verification-1',
                    createdAt: new Date(),
                  }),
            ),
            update: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          }),
      );

      await expect(service.resendOtp('user-1')).rejects.toMatchObject({
        status: 429,
      });
      expect(mailer.sendOtp).not.toHaveBeenCalled();
    });

    it('issues a fresh OTP once the cooldown has elapsed', async () => {
      (users.findById as jest.Mock).mockResolvedValue(allowedDomainUser);
      const save = jest.fn().mockResolvedValue(undefined);
      dataSource.transaction.mockImplementation(
        async (callback: (manager: Record<string, jest.Mock>) => unknown) =>
          callback({
            findOne: jest.fn().mockImplementation((entity) =>
              entity === User
                ? Promise.resolve(allowedDomainUser)
                : Promise.resolve({
                    id: 'verification-1',
                    createdAt: new Date(Date.now() - 10 * 60_000),
                  }),
            ),
            update: jest.fn().mockResolvedValue(undefined),
            create: jest.fn().mockImplementation((_entity, value) => value),
            save,
          }),
      );

      await expect(service.resendOtp('user-1')).resolves.toEqual({
        message: 'OTP mới đã được gửi',
      });
      expect(save).toHaveBeenCalledWith(
        StudentVerification,
        expect.objectContaining({ userId: 'user-1', otpCode: '123456' }),
      );
      expect(mailer.sendOtp).toHaveBeenCalledWith(
        'b21dccn001@stu.ptit.edu.vn',
        '123456',
      );
    });
  });
});
