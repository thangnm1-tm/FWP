import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  GoneException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsInt, Max, Min } from 'class-validator';
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

class GetMessagesQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1)
  @Max(100)
  limit: number = 50;
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
    @Query() query: GetMessagesQueryDto,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) rawLimit: number,
  ) {
    // `rawLimit` applies ParseIntPipe + DefaultValuePipe(50) so non-numeric
    // input is rejected before it can reach `.take()` as NaN; the DTO enforces
    // integer bounds (1..100). Clamp defensively as a final guard.
    const limit = Math.min(Math.max(query.limit ?? rawLimit, 1), 100);
    return this.chatService.getMessages(roomId, req.user.id, limit);
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
  @ApiOperation({ summary: 'Legacy reveal request (chat identities are visible after matching)', deprecated: true })
  async requestReveal(
    @Request() req: any,
    @Param('matchId') matchId: string,
  ) {
    throw new GoneException('Reveal is no longer required. Chat identities are visible after matching.');
  }

  @Post('reveal/:matchId/decline')
  @ApiOperation({ summary: 'Legacy reveal decline (chat identities are visible after matching)', deprecated: true })
  async declineReveal(
    @Request() req: any,
    @Param('matchId') matchId: string,
  ) {
    throw new GoneException('Reveal is no longer required. Chat identities are visible after matching.');
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
