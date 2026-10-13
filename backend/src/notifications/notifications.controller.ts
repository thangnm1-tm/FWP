import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
class DeviceTokenDto { @IsString() @MaxLength(500) token: string; @IsString() @IsIn(['android', 'ios', 'web']) platform: string; }
@ApiTags('Notifications') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Post('device-token') register(@Request() req: any, @Body() dto: DeviceTokenDto) { return this.notifications.registerDevice(req.user.id, dto.token, dto.platform); }
}
