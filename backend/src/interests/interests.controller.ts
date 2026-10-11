import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InterestsService } from './interests.service';
import { IsArray, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SetInterestsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  interestIds: string[];
}

@ApiTags('Interests')
@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available interests' })
  async getAllInterests() {
    return this.interestsService.findAll();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user interests' })
  async getMyInterests(@Request() req: any) {
    return this.interestsService.getUserInterests(req.user.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set current user interests (max 20)' })
  async setMyInterests(
    @Request() req: any,
    @Body() dto: SetInterestsDto,
  ) {
    return this.interestsService.setUserInterests(req.user.id, dto.interestIds);
  }
}
