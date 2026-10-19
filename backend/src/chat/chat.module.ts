import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChatRoom,
  Message,
  Block,
  Report,
} from './entities/chat.entities';
import { Match } from '../matches/entities/match.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    ProfilesModule,
    UsersModule,
    TypeOrmModule.forFeature([
      ChatRoom,
      Message,
      Block,
      Report,
      Match,
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
