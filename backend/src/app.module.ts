import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProfilesModule } from './profiles/profiles.module';
import { InterestsModule } from './interests/interests.module';
import { PreferencesModule } from './preferences/preferences.module';
import { SwipeModule } from './swipe/swipe.module';
import { MatchesModule } from './matches/matches.module';
import { RecommendationModule } from './recommendation/recommendation.module';
import { ChatModule } from './chat/chat.module';
import { LocationModule } from './location/location.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST', 'localhost'),
        port: configService.get<number>('POSTGRES_PORT', 5432),
        username: configService.get('POSTGRES_USER', 'fwp_user'),
        password: configService.get('POSTGRES_PASSWORD', 'fwp_password_change_me'),
        database: configService.get('POSTGRES_DB', 'fwp_db'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // Includes entities registered by feature modules, including the
        // chat entities kept together in chat.entities.ts.
        autoLoadEntities: true,
        synchronize: false, // Use migrations in production
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: true,
        logging: configService.get('NODE_ENV') === 'development',
      }),
    }),

    // Feature Modules
    AuthModule,
    UsersModule,
    ProfilesModule,
    InterestsModule,
    PreferencesModule,
    SwipeModule,
    MatchesModule,
    RecommendationModule,
    ChatModule,
    LocationModule,
    NotificationsModule,
  ],
})
export class AppModule {}
