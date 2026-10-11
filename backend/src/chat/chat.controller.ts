import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';

class SendMessageDto {
  @ApiProperty() @IsString()
  content: string;
}

class BlockUserDto {
  @ApiProperty() @IsString()
  userId: string;
}

class ReportUserDto {
  @ApiProperty() @IsString()
  userId: string;

  @ApiProperty() @IsString()
  reason: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  description?: string;
}

@ApiTags('Chat')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('chat/rooms')
  @ApiOperation({ summary: 'Get all chat rooms' })
  async getChatRooms(@Request() req: any) {
    return this.chatService.getUserChatRooms(req.user.id);
  }

  @Get('chat/:roomId/messages')
  @ApiOperation({ summary: 'Get messages in a chat room' })
  async getMessages(
    @Request() req: any,
    @Param('roomId') roomId: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(roomId, req.user.id, limit || 50);
  }

  @Post('chat/:roomId/messages')
  @ApiOperation({ summary: 'Send a message' })
  async sendMessage(
    @Request() req: any,
    @Param('roomId') roomId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(roomId, req.user.id, dto.content);
  }

  @Post('reveal/:matchId/request')
  @ApiOperation({ summary: 'Request identity reveal' })
  async requestReveal(
    @Request() req: any,
    @Param('matchId') matchId: string,
  ) {
    return this.chatService.requestReveal(matchId, req.user.id);
  }

  @Post('reveal/:matchId/decline')
  @ApiOperation({ summary: 'Decline identity reveal' })
  async declineReveal(
    @Request() req: any,
    @Param('matchId') matchId: string,
  ) {
    return this.chatService.declineReveal(matchId, req.user.id);
  }

  @Post('block')
  @ApiOperation({ summary: 'Block a user' })
  async blockUser(@Request() req: any, @Body() dto: BlockUserDto) {
    await this.chatService.blockUser(req.user.id, dto.userId);
    return { message: 'User blocked' };
  }

  @Post('report')
  @ApiOperation({ summary: 'Report a user' })
  async reportUser(@Request() req: any, @Body() dto: ReportUserDto) {
    return this.chatService.reportUser(
      req.user.id, dto.userId, dto.reason, dto.description,
    );
  }
}
