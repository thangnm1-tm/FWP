import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { UserStatus } from '../users/entities/user.entity';
import { RegisterDto, LoginDto, VerifyOtpDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly allowedDomains: string[];
  private readonly maxOtpAttempts = 5;
  private readonly otpExpirationMinutes = 10;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
    // Validate email domain
    const emailDomain = dto.email.split('@')[1];
    if (!this.allowedDomains.includes(emailDomain)) {
      throw new BadRequestException(
        `Email phải thuộc domain: ${this.allowedDomains.join(', ')}`,
      );
    }

    // Check existing user
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã được đăng ký');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.usersService.createUser(dto.email, passwordHash);

    // Generate and send OTP
    const otpCode = this.generateOtp();
    const expiresAt = new Date(
      Date.now() + this.otpExpirationMinutes * 60 * 1000,
    );
    await this.usersService.createVerification(user.id, otpCode, expiresAt);

    // TODO: Send OTP via email (SMTP integration)
    // For development, log OTP
    console.log(`[DEV] OTP for ${dto.email}: ${otpCode}`);

    return {
      message: 'Đăng ký thành công. Vui lòng xác thực email bằng OTP.',
      userId: user.id,
      // Only include OTP in development mode
      ...(this.configService.get('NODE_ENV') === 'development' && {
        devOtp: otpCode,
      }),
    };
  }

  /**
   * Verify student email with OTP
   */
  async verifyOtp(userId: string, dto: VerifyOtpDto) {
    const verification =
      await this.usersService.findLatestVerification(userId);

    if (!verification) {
      throw new BadRequestException('Không tìm thấy yêu cầu xác thực');
    }

    if (verification.verified) {
      throw new BadRequestException('Email đã được xác thực');
    }

    if (verification.attempts >= this.maxOtpAttempts) {
      throw new BadRequestException(
        'Đã vượt quá số lần thử. Vui lòng yêu cầu OTP mới.',
      );
    }

    if (new Date() > verification.otpExpiresAt) {
      throw new BadRequestException('OTP đã hết hạn');
    }

    await this.usersService.incrementVerificationAttempts(verification.id);

    if (verification.otpCode !== dto.otpCode) {
      throw new BadRequestException('OTP không chính xác');
    }

    // Mark as verified
    await this.usersService.markVerified(verification.id);
    await this.usersService.activateUser(userId);

    // Generate tokens
    return this.generateTokens(userId, verification.userId);
  }

  /**
   * Login with email & password
   */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
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
    if (!user) {
      throw new BadRequestException('User không tồn tại');
    }

    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException('Tài khoản đã được xác thực');
    }

    const otpCode = this.generateOtp();
    const expiresAt = new Date(
      Date.now() + this.otpExpirationMinutes * 60 * 1000,
    );
    await this.usersService.createVerification(user.id, otpCode, expiresAt);

    console.log(`[DEV] New OTP for ${user.email}: ${otpCode}`);

    return {
      message: 'OTP mới đã được gửi',
      ...(this.configService.get('NODE_ENV') === 'development' && {
        devOtp: otpCode,
      }),
    };
  }

  // ──── Private helpers ────

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
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
