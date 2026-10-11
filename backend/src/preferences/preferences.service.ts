import { Injectable } from '@nestjs/common';
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
    let preference = await this.findByUserId(userId);
    if (!preference) {
      preference = this.preferenceRepository.create({ userId, ...data });
    } else {
      Object.assign(preference, data);
    }
    return this.preferenceRepository.save(preference);
  }
}
