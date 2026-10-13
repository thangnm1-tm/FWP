import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Request,
  Post,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MediaService } from '../media/media.service';

@ApiTags('Profile')
@Controller('profile')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService, private readonly mediaService: MediaService) {}

  @Get('options')
  @ApiOperation({ summary: 'Get universities and faculties for profile onboarding' })
  async getProfileOptions() {
    return this.profilesService.getProfileOptions();
  }

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: any) {
    const profile = await this.profilesService.findByUserId(req.user.id);
    if (!profile) {
      return this.profilesService.createProfile(req.user.id);
    }
    return profile;
  }

  @Put()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.updateProfile(req.user.id, dto);
  }

  @Post('photos')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload a profile photo to Cloudinary' })
  async uploadPhoto(
    @Request() req: any,
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 8 * 1024 * 1024 }), new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ })] })) file: Express.Multer.File,
  ) {
    const url = await this.mediaService.uploadProfilePhoto(req.user.id, file);
    const profile = await this.profilesService.addPhoto(req.user.id, url);
    return { url, photos: profile.photos };
  }
}
