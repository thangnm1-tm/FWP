import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
  constructor(private readonly config: ConfigService) {}

  async sendOtp(email: string, otp: string): Promise<void> {
    if (this.config.get<string>('OTP_DELIVERY_MODE') === 'demo') return;
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const password = this.config.get<string>('SMTP_PASSWORD');
    if (!host || !user || !password) {
      throw new ServiceUnavailableException(
        'Dịch vụ email chưa được cấu hình. Hãy đặt SMTP_HOST, SMTP_USER và SMTP_PASSWORD.',
      );
    }
    const port = this.config.get<number>('SMTP_PORT', 587);
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass: password },
    });
    try {
      await transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM', user), to: email,
        subject: 'FwP - Mã xác thực email',
        text: `Mã OTP FwP của bạn là ${otp}. Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.`,
      });
    } catch {
      throw new ServiceUnavailableException('Không thể gửi OTP. Hãy kiểm tra cấu hình SMTP rồi thử lại.');
    }
  }
}
