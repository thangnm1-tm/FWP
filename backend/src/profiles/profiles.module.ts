import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from './entities/profile.entity';
import { University } from './entities/university.entity';
import { Faculty } from './entities/faculty.entity';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [TypeOrmModule.forFeature([Profile, University, Faculty]), MediaModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
