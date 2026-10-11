import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from './entities/user.entity';
import { StudentVerification } from './entities/student-verification.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(StudentVerification)
    private readonly verificationRepository: Repository<StudentVerification>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async createUser(email: string, passwordHash: string): Promise<User> {
    const user = this.userRepository.create({
      email,
      passwordHash,
      status: UserStatus.PENDING,
    });
    return this.userRepository.save(user);
  }

  async activateUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, { status: UserStatus.ACTIVE });
  }

  async createVerification(
    userId: string,
    otpCode: string,
    expiresAt: Date,
  ): Promise<StudentVerification> {
    // Invalidate previous OTPs
    await this.verificationRepository.update(
      { userId, verified: false },
      { otpExpiresAt: new Date() },
    );

    const verification = this.verificationRepository.create({
      userId,
      otpCode,
      otpExpiresAt: expiresAt,
    });
    return this.verificationRepository.save(verification);
  }

  async findLatestVerification(
    userId: string,
  ): Promise<StudentVerification | null> {
    return this.verificationRepository.findOne({
      where: { userId, verified: false },
      order: { createdAt: 'DESC' },
    });
  }

  async markVerified(verificationId: string): Promise<void> {
    await this.verificationRepository.update(verificationId, {
      verified: true,
      verifiedAt: new Date(),
    });
  }

  async incrementVerificationAttempts(verificationId: string): Promise<void> {
    await this.verificationRepository.increment(
      { id: verificationId },
      'attempts',
      1,
    );
  }
}
