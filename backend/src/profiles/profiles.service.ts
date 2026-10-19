import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile, gpaToBucket } from './entities/profile.entity';
import { University } from './entities/university.entity';
import { Faculty } from './entities/faculty.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(University)
    private readonly universityRepository: Repository<University>,
    @InjectRepository(Faculty)
    private readonly facultyRepository: Repository<Faculty>,
  ) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.profileRepository.findOne({
      where: { userId },
      relations: ['university', 'faculty'],
    });
  }

  async getChatProfiles(userIds: string[]): Promise<Pick<Profile, 'userId' | 'displayName' | 'photos'>[]> {
    if (userIds.length === 0) return [];
    return this.profileRepository
      .createQueryBuilder('profile')
      .select(['profile.userId', 'profile.displayName', 'profile.photos'])
      .where('profile.userId IN (:...userIds)', { userIds })
      .getMany();
  }

  async createProfile(userId: string): Promise<Profile> {
    const profile = this.profileRepository.create({ userId });
    return this.profileRepository.save(profile);
  }

  async getProfileOptions() {
    const universities = await this.universityRepository.find({ where: { active: true }, order: { name: 'ASC' } });
    const faculties = await this.facultyRepository.find({ order: { name: 'ASC' } });
    return { universities, faculties };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<Profile> {
    let profile = await this.findByUserId(userId);
    if (!profile) {
      profile = await this.createProfile(userId);
    }

    // Auto-compute GPA bucket
    if (dto.gpa !== undefined) {
      (dto as any).gpaBucket = gpaToBucket(dto.gpa);
    }

    if (dto.photos && dto.photos.length > 0) profile.photos = dto.photos;

    Object.assign(profile, dto);

    if (profile.dateOfBirth && profile.dateOfBirth > new Date(new Date().setFullYear(new Date().getFullYear() - 18))) {
      throw new BadRequestException('FwP chỉ dành cho người dùng từ đủ 18 tuổi.');
    }

    // Check profile completeness
    const isComplete =
      !!profile.displayName &&
      !!profile.dateOfBirth &&
      !!profile.gender &&
      !!profile.bio &&
      (profile.photos?.length || 0) > 0 &&
      profile.gpa !== null &&
      profile.gpa !== undefined &&
      !!profile.universityId &&
      !!profile.facultyId;

    if (dto.discoverable === true && !isComplete) {
      throw new BadRequestException(
        'Hãy thêm ảnh, tên, ngày sinh, giới thiệu, GPA, trường và khoa trước khi bật Khám phá.',
      );
    }

    profile.profileCompleted = isComplete;

    if (dto.gpa !== undefined) {
      profile.gpaBucket = gpaToBucket(dto.gpa);
    }

    return this.profileRepository.save(profile);
  }

  async addPhoto(userId: string, url: string): Promise<Profile> {
    let profile = await this.findByUserId(userId);
    if (!profile) profile = await this.createProfile(userId);
    if (profile.photos.includes(url)) return profile;
    profile.photos = [...profile.photos, url];
    profile.profileCompleted = this.isComplete(profile);
    return this.profileRepository.save(profile);
  }

  private isComplete(profile: Profile): boolean {
    return !!profile.displayName && !!profile.dateOfBirth && !!profile.gender &&
      !!profile.bio && (profile.photos?.length || 0) > 0 &&
      profile.gpa !== null && profile.gpa !== undefined &&
      !!profile.universityId && !!profile.facultyId;
  }
}
