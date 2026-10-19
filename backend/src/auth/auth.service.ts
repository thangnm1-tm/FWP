import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserStatus } from '../users/entities/user.entity';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto/auth.dto';
import { MailerService } from '../mailer/mailer.service';
import { DataSource } from 'typeorm';
import { StudentVerification } from '../users/entities/student-verification.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  private readonly allowedDomains: string[];
  private readonly maxOtpAttempts = 5;
  private readonly otpExpirationMinutes = 10;
  private readonly defaultOtpResendCooldownSeconds = 60;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
    private readonly dataSource: DataSource,
  ) {
    this.allowedDomains = this.configService
      .get<string>('ALLOWED_EMAIL_DOMAINS', 'stu.ptit.edu.vn')
      .split(',')
      .map((d) => d.trim());
  }

  /**
   * Register a new user with student email
   */
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    // Validate email domain
    const emailDomain = email.split('@')[1];
    if (!this.allowedDomains.includes(emailDomain)) {
      throw new BadRequestException(
        `Email phải thuộc domain: ${this.allowedDomains.join(', ')}`,
      );
    }

    // Check existing user
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      if (existing.status === UserStatus.PENDING) {
        const passwordMatches = await bcrypt.compare(
          dto.password,
          existing.passwordHash,
        );
        if (!passwordMatches) {
          throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
        }
        await this.issueOtp(existing.id, existing.email);
        return {
          message: 'OTP mới đã được gửi. Vui lòng xác thực email.',
          userId: existing.id,
          ...this.demoOtpResponse(),
        };
      }
      throw new ConflictException('Email đã được đăng ký');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.usersService.createUser(email, passwordHash);

    // Generate and send OTP
    await this.issueOtp(user.id, user.email);

    return {
      message: 'Đăng ký thành công. Vui lòng xác thực email bằng OTP.',
      userId: user.id,
      ...this.demoOtpResponse(),
    };
  }

  /**
   * Verify student email with OTP
   */
  async verifyOtp(userId: string, dto: VerifyOtpDto) {
    const result = await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id: userId } });
      // Do not disclose whether a user id exists. The same response is used
      // for an unknown id, an active account, and a missing OTP challenge.
      if (!user || user.status !== UserStatus.PENDING) {
        return { error: 'invalid-challenge' as const };
      }

      const verification = await manager.findOne(StudentVerification, {
        where: { userId, verified: false },
        order: { createdAt: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!verification) return { error: 'invalid-challenge' as const };
      if (verification.attempts >= this.maxOtpAttempts) return { error: 'attempts' as const };
      if (new Date() > verification.otpExpiresAt) return { error: 'expired' as const };

      // This update commits even for an invalid code; throwing inside the
      // transaction would roll the attempt increment back.
      await manager.increment(StudentVerification, { id: verification.id }, 'attempts', 1);
      if (verification.otpCode !== dto.otpCode) return { error: 'invalid-code' as const };

      await manager.update(StudentVerification, verification.id, {
        verified: true,
        verifiedAt: new Date(),
      });
      await manager.update(User, userId, { status: UserStatus.ACTIVE });
      return { user };
    });

    if ('error' in result && result.error) {
      const messages = {
        'invalid-challenge': 'Yêu cầu xác thực không hợp lệ hoặc đã hết hạn',
        attempts: 'Đã vượt quá số lần thử. Vui lòng yêu cầu OTP mới.',
        expired: 'OTP đã hết hạn',
        'invalid-code': 'OTP không chính xác',
      } as const;
      throw new BadRequestException(messages[result.error]);
    }

    // Generate tokens
    return this.generateTokens(result.user.id, result.user.email);
  }

  /**
   * Login with email & password
   */
  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Tài khoản chưa được xác thực');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Tài khoản đã bị tạm khóa');
    }

    return this.generateTokens(user.id, user.email);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException();
      }

      return this.generateTokens(user.id, user.email);
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
  }

  /**
   * Resend OTP for verification
   */
  async resendOtp(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user || user.status !== UserStatus.PENDING) {
      throw new BadRequestException(
        'Yêu cầu xác thực không hợp lệ hoặc đã hết hạn',
      );
    }

    await this.issueOtp(user.id, user.email);

    return {
      message: 'OTP mới đã được gửi',
    };
  }

  // ──── Private helpers ────

  private generateOtp(): string {
    if (this.configService.get<string>('OTP_DELIVERY_MODE') === 'demo') {
      return this.configService.get<string>('DEMO_OTP', '123456');
    }
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private demoOtpResponse(): Record<string, string> {
    return this.configService.get<string>('OTP_DELIVERY_MODE') === 'demo'
      ? { devOtp: this.configService.get<string>('DEMO_OTP', '123456') }
      : {};
  }

  private async issueOtp(userId: string, email: string): Promise<void> {
    const cooldownSeconds = this.configService.get<number>(
      'OTP_RESEND_COOLDOWN_SECONDS',
      this.defaultOtpResendCooldownSeconds,
    );
    const otpCode = this.generateOtp();
    const expiresAt = new Date(Date.now() + this.otpExpirationMinutes * 60 * 1000);

    await this.dataSource.transaction(async (manager) => {
      // Serialize OTP issuance per account so the cooldown cannot be bypassed
      // by concurrent resend requests.
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user || user.status !== UserStatus.PENDING) {
        throw new BadRequestException(
          'Yêu cầu xác thực không hợp lệ hoặc đã hết hạn',
        );
      }
      const latest = await manager.findOne(StudentVerification, {
        where: { userId, verified: false },
        order: { createdAt: 'DESC' },
      });
      if (
        latest?.createdAt &&
        Date.now() - new Date(latest.createdAt).getTime() < cooldownSeconds * 1000
      ) {
      throw new HttpException(
          `Vui lòng chờ ${cooldownSeconds} giây trước khi yêu cầu OTP mới`,
        HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      await manager.update(
        StudentVerification,
        { userId, verified: false },
        { otpExpiresAt: new Date() },
      );
      const verification = manager.create(StudentVerification, {
        userId,
        otpCode,
        otpExpiresAt: expiresAt,
      });
      await manager.save(StudentVerification, verification);
    });
    await this.mailerService.sendOtp(email, otpCode);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
    };
  }
}
