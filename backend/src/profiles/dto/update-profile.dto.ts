import { IsString, IsOptional, IsEnum, IsNumber, IsArray, IsBoolean, Min, Max, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, Purpose } from '../entities/profile.entity';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 4 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(4)
  gpa?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  universityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facultyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(6)
  academicYear?: number;

  @ApiPropertyOptional({ enum: Purpose })
  @IsOptional()
  @IsEnum(Purpose)
  purpose?: Purpose;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  gpaVisible?: boolean;

  @ApiPropertyOptional({ description: 'Allow this profile to appear in Discover' })
  @IsOptional()
  @IsBoolean()
  discoverable?: boolean;
}
