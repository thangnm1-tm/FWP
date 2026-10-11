import { Controller, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsNumber, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LocationService } from './location.service';

class UpdateLocationDto {
  @ApiProperty({ example: 21.0285 })
  @IsNumber()
  @Min(-90) @Max(90)
  latitude: number;

  @ApiProperty({ example: 105.8542 })
  @IsNumber()
  @Min(-180) @Max(180)
  longitude: number;
}

@ApiTags('Location')
@Controller('location')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Put()
  @ApiOperation({ summary: 'Update user location' })
  async updateLocation(@Request() req: any, @Body() dto: UpdateLocationDto) {
    await this.locationService.updateLocation(req.user.id, dto.latitude, dto.longitude);
    return { message: 'Location updated' };
  }
}
