import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Preference } from './entities/preference.entity';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(Preference)
    private readonly preferenceRepository: Repository<Preference>,
  ) {}

  async findByUserId(userId: string): Promise<Preference | null> {
    return this.preferenceRepository.findOne({ where: { userId } });
  }

  async upsert(userId: string, data: Partial<Preference>): Promise<Preference> {
    const current = await this.findByUserId(userId);
    const minAge = data.minAge ?? current?.minAge ?? 18;
    const maxAge = data.maxAge ?? current?.maxAge ?? 30;
    if (minAge > maxAge) throw new BadRequestException('minAge must not exceed maxAge');
    let preference = await this.findByUserId(userId);
    if (!preference) {
      preference = this.preferenceRepository.create({ userId, ...data });
    } else {
      Object.assign(preference, data);
    }
    return this.preferenceRepository.save(preference);
  }
}
