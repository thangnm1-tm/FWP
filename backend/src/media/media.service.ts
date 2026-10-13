import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({ cloud_name: config.get('CLOUDINARY_CLOUD_NAME'), api_key: config.get('CLOUDINARY_API_KEY'), api_secret: config.get('CLOUDINARY_API_SECRET'), secure: true });
  }

  async uploadProfilePhoto(userId: string, file: Express.Multer.File): Promise<string> {
    if (!file?.buffer) throw new BadRequestException('Không có ảnh để tải lên');
    const cloudName = this.config.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret || cloudName === 'demo' || apiKey === 'demo') {
      throw new ServiceUnavailableException('Dịch vụ Cloudinary chưa được cấu hình trong môi trường demo.');
    }

    try {
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `fwp/profiles/${userId}`,
            resource_type: 'image',
            transformation: [
              { width: 1200, height: 1200, crop: 'limit' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, upload) => {
            if (error || !upload) {
              return reject(error || new Error('Cloudinary upload failed'));
            }
            resolve(upload);
          },
        );
        stream.end(file.buffer);
      });
      return result.secure_url;
    } catch (err: any) {
      throw new ServiceUnavailableException(
        `Lỗi tải ảnh lên Cloudinary: ${err?.message || 'Không thể kết nối dịch vụ Cloudinary'}`,
      );
    }
  }
}
