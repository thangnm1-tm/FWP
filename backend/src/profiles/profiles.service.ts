import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Profile, gpaToBucket } from './entities/profile.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
  ) {}

  async findByUserId(userId: string): Promise<Profile | null> {
    return this.profileRepository.findOne({
      where: { userId },
      relations: ['university', 'faculty'],
    });
  }

  async createProfile(userId: string): Promise<Profile> {
    const profile = this.profileRepository.create({ userId });
    return this.profileRepository.save(profile);
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

    // Check profile completeness
    const updated = { ...profile, ...dto };
    const isComplete =
      !!updated.displayName &&
      !!updated.dateOfBirth &&
      !!updated.gender &&
      !!updated.bio &&
      updated.photos.length > 0 &&
      updated.gpa !== null &&
      !!updated.universityId &&
      !!updated.facultyId;

    Object.assign(profile, dto);
    profile.profileCompleted = isComplete;

    if (dto.gpa !== undefined) {
      profile.gpaBucket = gpaToBucket(dto.gpa);
    }

    return this.profileRepository.save(profile);
  }

  async getProfileForCandidate(
    userId: string,
    isRevealed: boolean,
  ): Promise<Partial<Profile>> {
    const profile = await this.findByUserId(userId);
    if (!profile) throw new NotFoundException('Profile not found');

    // If identity not revealed, hide certain fields
    if (!isRevealed) {
      return {
        id: profile.id,
        gender: profile.gender,
        bio: profile.bio,
        photos: [], // No photos before reveal
        gpaBucket: profile.gpaVisible ? profile.gpaBucket : null,
        universityId: profile.universityId,
        facultyId: profile.facultyId,
        academicYear: profile.academicYear,
        purpose: profile.purpose,
      };
    }

    return profile;
  }
}
