import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';
import { buildNotificationEmailHtml, NotificationEmailContext } from './templates/notification.template';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly appBaseUrl: string;

  constructor() {
    this.appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  buildTrackingPixelUrl(trackingId: string): string {
    return `${this.appBaseUrl}/api/v1/email/track/${trackingId}`;
  }

  buildNotificationHtml(ctx: Omit<NotificationEmailContext, 'appBaseUrl'>): string {
    return buildNotificationEmailHtml({ ...ctx, appBaseUrl: this.appBaseUrl });
  }

  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
    const from = process.env.EMAIL_FROM ?? 'noreply@resolveiq.com';
    try {
      if (process.env.SENDGRID_API_KEY) {
        const [response] = await sgMail.send({ ...options, from });
        return { success: true, messageId: response.headers['x-message-id'] as string };
      }
      // Fallback: Nodemailer (dev / SMTP)
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'localhost',
        port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
        secure: false,
      });
      const info = await transporter.sendMail({ from, ...options });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}`, err);
      return { success: false };
    }
  }
}
