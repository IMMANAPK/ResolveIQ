import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sgMail = require('@sendgrid/mail').default ?? require('@sendgrid/mail');
import { buildNotificationEmailHtml, NotificationEmailContext } from './templates/notification.template';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly backendUrl: string;

  constructor(private configService: ConfigService) {
    this.backendUrl = this.configService.get<string>('BACKEND_URL') || 
                      this.configService.get<string>('APP_BASE_URL') || 
                      'http://localhost:3000';
    const sgKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (sgKey && sgKey !== 'your-key-here') {
      sgMail.setApiKey(sgKey);
    }
  }

  buildTrackingPixelUrl(trackingId: string): string {
    return `${this.backendUrl}/api/v1/email/track/${trackingId}`;
  }

  buildNotificationHtml(ctx: Omit<NotificationEmailContext, 'appBaseUrl'>): string {
    return buildNotificationEmailHtml({ ...ctx, appBaseUrl: this.backendUrl });
  }

  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
    const from = this.configService.get<string>('EMAIL_FROM') ?? 'noreply@resolveiq.com';
    const sgKey = this.configService.get<string>('SENDGRID_API_KEY');
    const smtpHost = this.configService.get<string>('SMTP_HOST');

    try {
      // Logic: If SMTP is configured, prefer it (e.g. for Gmail). 
      // If no SMTP but SendGrid key is present and not a placeholder, use SendGrid.
      if (smtpHost) {
        this.logger.log(`Sending email to ${options.to} via SMTP (${smtpHost})`);
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(this.configService.get<string>('SMTP_PORT') ?? '587', 10),
          secure: false, // true for 465, false for other ports
          auth: {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASS'),
          },
        });
        const info = await transporter.sendMail({ from, ...options });
        return { success: true, messageId: info.messageId };
      } 
      
      if (sgKey && sgKey !== 'your-key-here' && sgKey.trim() !== '') {
        this.logger.log(`Sending email to ${options.to} via SendGrid`);
        const [response] = await sgMail.send({ ...options, from });
        return { success: true, messageId: response.headers['x-message-id'] as string };
      }

      this.logger.error('No valid email transport configured (SMTP or SendGrid)');
      return { success: false };
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}`, err);
      return { success: false };
    }
  }
}
