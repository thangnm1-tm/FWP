import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SwipeService } from './swipe.service';
import { SwipeAction } from './entities/swipe-event.entity';

class SwipeDto {
  @ApiProperty()
  @IsString()
  candidateId: string;

  @ApiProperty({ enum: SwipeAction })
  @IsEnum(SwipeAction)
  action: SwipeAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  impressionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;
}

@ApiTags('Swipe')
@Controller('swipe')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SwipeController {
  constructor(private readonly swipeService: SwipeService) {}

  @Post()
  @ApiOperation({ summary: 'Swipe LIKE or PASS on a candidate' })
  async swipe(@Request() req: any, @Body() dto: SwipeDto) {
    return this.swipeService.swipe(
      req.user.id,
      dto.candidateId,
      dto.action,
      dto.impressionId,
      dto.sessionId,
    );
  }
}
