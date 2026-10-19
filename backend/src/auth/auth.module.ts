import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { MailerModule } from '../mailer/mailer.module';

const WEAK_JWT_SECRETS = new Set([
  'CHANGE_ME_dev_only_jwt_secret',
  'CHANGE_ME_dev_only_jwt_refresh_secret',
  'change_me',
  'secret',
  'jwt_secret',
]);

function requireJwtSecret(configService: ConfigService, name: string): string {
  const secret = configService.get<string>(name)?.trim();
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  if (!secret || (isProduction && (secret.length < 32 || WEAK_JWT_SECRETS.has(secret)))) {
    throw new Error(
      `${name} must be a strong secret of at least 32 characters in production; ` +
      'replace the placeholder value before starting the backend',
    );
  }
  return secret;
}

@Module({
  imports: [
    UsersModule,
    MailerModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = requireJwtSecret(configService, 'JWT_SECRET');
        // AuthService signs refresh tokens directly, so validate that secret
        // during application startup rather than on the first refresh call.
        requireJwtSecret(configService, 'JWT_REFRESH_SECRET');
        return {
          secret,
          signOptions: {
            expiresIn: configService.get('JWT_EXPIRATION', '15m'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // JwtModule is also used by the WebSocket gateway to authenticate handshakes.
  exports: [AuthService, JwtStrategy, JwtModule],
})
export class AuthModule {}
