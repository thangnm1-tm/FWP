import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Repository } from 'typeorm';
import { DeviceToken } from '../users/entities/device-token.entity';

export interface PushPayload { title: string; body: string; data?: Record<string, string> }

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;
  constructor(@InjectRepository(DeviceToken) private readonly tokens: Repository<DeviceToken>, private readonly config: ConfigService) {}

  async registerDevice(userId: string, token: string, platform = 'android'): Promise<DeviceToken> {
    const existing = await this.tokens.findOne({ where: { token } });
    if (existing) { existing.userId = userId; existing.platform = platform; return this.tokens.save(existing); }
    return this.tokens.save(this.tokens.create({ userId, token, platform }));
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!userIds.length || !this.ensureFirebase()) return;
    const records = await this.tokens.find({ where: userIds.map((userId) => ({ userId })) });
    if (!records.length) return;
    const result = await getMessaging().sendEachForMulticast({ tokens: records.map((record) => record.token), notification: { title: payload.title, body: payload.body }, data: payload.data });
    const invalidTokens = records.filter((_, index) => !result.responses[index].success && ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(result.responses[index].error?.code || ''));
    if (invalidTokens.length) await this.tokens.remove(invalidTokens);
  }

  private ensureFirebase(): boolean {
    if (this.initialized) return true;
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!raw) return false;
    try { if (!getApps().length) initializeApp({ credential: cert(JSON.parse(raw)) }); this.initialized = true; return true; }
    catch (error) { this.logger.error('Firebase Admin initialization failed', error instanceof Error ? error.stack : undefined); return false; }
  }
}
