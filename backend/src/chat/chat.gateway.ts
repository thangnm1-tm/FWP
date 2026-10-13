import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { NotificationsService } from '../notifications/notifications.service';

type AuthSocket = Socket & { userId?: string };
type SendMessageEvent = { roomId: string; content: string };
type RoomEvent = { roomId: string };

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*', credentials: true } })
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);
  private readonly online = new Map<string, number>();

  constructor(private readonly jwt: JwtService, private readonly config: ConfigService, private readonly chat: ChatService, private readonly notifications: NotificationsService) {}

  async handleConnection(socket: AuthSocket): Promise<void> {
    try {
      const queryToken = socket.handshake.query?.token;
      const raw = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') || (typeof queryToken === 'string' ? queryToken : '');
      if (!raw) throw new Error('Missing token');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(raw, { secret: this.config.get('JWT_SECRET', 'dev_jwt_secret_key_12345') });
      socket.userId = payload.sub;
      socket.join(`user:${payload.sub}`);
      this.online.set(payload.sub, (this.online.get(payload.sub) || 0) + 1);
      this.server.emit('presence', { userId: payload.sub, online: true });
    } catch {
      socket.emit('exception', { message: 'Unauthorized WebSocket connection' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthSocket): void {
    if (!socket.userId) return;
    const remaining = (this.online.get(socket.userId) || 1) - 1;
    if (remaining <= 0) { this.online.delete(socket.userId); this.server.emit('presence', { userId: socket.userId, online: false }); }
    else this.online.set(socket.userId, remaining);
  }

  @SubscribeMessage('room:join')
  async joinRoom(@ConnectedSocket() socket: AuthSocket, @MessageBody() body: RoomEvent) {
    if (!socket.userId) return;
    await this.chat.assertChatAccess(body.roomId, socket.userId);
    socket.join(`room:${body.roomId}`);
    return { event: 'room:joined', data: { roomId: body.roomId } };
  }

  @SubscribeMessage('typing:start')
  async typingStart(@ConnectedSocket() socket: AuthSocket, @MessageBody() body: RoomEvent) { return this.typing(socket, body, true); }
  @SubscribeMessage('typing:stop')
  async typingStop(@ConnectedSocket() socket: AuthSocket, @MessageBody() body: RoomEvent) { return this.typing(socket, body, false); }
  private async typing(socket: AuthSocket, body: RoomEvent, typing: boolean) {
    if (!socket.userId) return;
    await this.chat.assertChatAccess(body.roomId, socket.userId);
    socket.to(`room:${body.roomId}`).emit('typing', { roomId: body.roomId, userId: socket.userId, typing });
  }

  @SubscribeMessage('message:send')
  async sendMessage(@ConnectedSocket() socket: AuthSocket, @MessageBody() body: SendMessageEvent) {
    if (!socket.userId || !body?.content?.trim()) return { event: 'exception', data: { message: 'Nội dung tin nhắn không hợp lệ' } };
    const message = await this.chat.sendMessage(body.roomId, socket.userId, body.content.trim());
    this.server.to(`room:${body.roomId}`).emit('message:new', message);
    const recipientId = await this.chat.getOtherMemberId(body.roomId, socket.userId);
    this.server.to(`user:${recipientId}`).emit('message:new', message);
    await this.notifications.sendToUsers([recipientId], { title: 'Tin nhắn mới trên FwP', body: body.content.trim().slice(0, 100), data: { roomId: body.roomId, type: 'chat' } });
    return { event: 'message:sent', data: message };
  }

  isOnline(userId: string): boolean { return this.online.has(userId); }
  notifyUsers(userIds: string[], event: string, data: unknown): void { userIds.forEach((id) => this.server.to(`user:${id}`).emit(event, data)); }
}
