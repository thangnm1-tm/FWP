import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { StudentVerification } from './entities/student-verification.entity';
import { DeviceToken } from './entities/device-token.entity';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, StudentVerification, DeviceToken]),
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
