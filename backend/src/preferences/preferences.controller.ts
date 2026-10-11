import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsEnum, IsBoolean, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PreferencesService } from './preferences.service';
import { GpaPreference } from './entities/preference.entity';

class UpdatePreferencesDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  genderPreference?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(18) @Max(99)
  minAge?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(18) @Max(99)
  maxAge?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(100)
  maxDistanceKm?: number;

  @ApiPropertyOptional({ enum: GpaPreference })
  @IsOptional() @IsEnum(GpaPreference)
  gpaPreference?: GpaPreference;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(3)
  maxGpaTierDiff?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  sameUniversityOnly?: boolean;
}

@ApiTags('Preferences')
@Controller('preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user preferences' })
  async getPreferences(@Request() req: any) {
    return this.preferencesService.findByUserId(req.user.id) ?? {};
  }

  @Put()
  @ApiOperation({ summary: 'Update preferences' })
  async updatePreferences(@Request() req: any, @Body() dto: UpdatePreferencesDto) {
    return this.preferencesService.upsert(req.user.id, dto);
  }
}
