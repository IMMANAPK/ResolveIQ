import { Injectable, Logger, Optional } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { SettingsService } from '../settings/settings.service';
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
  private readonly appBaseUrl: string;

  // @Optional() prevents a hard DI error during early bootstrap before SettingsModule
  // has fully initialized — e.g. in EmailTrackerController which is loaded first.
  constructor(@Optional() private readonly settingsService?: SettingsService) {
    this.appBaseUrl = process.env.APP_BASE_URL ?? 'http://localhost:3000';
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  /**
   * Read a value from the DB-backed admin settings first,
   * fall back to the env variable, then the hardcoded default.
   * This ensures admin/settings page changes take effect without a restart.
   */
  private cfg(settingKey: string, envKey: string, defaultVal: string): string {
    const fromDb = this.settingsService?.get<string>(settingKey);
    if (fromDb !== undefined && fromDb !== null && String(fromDb).trim() !== '') {
      return String(fromDb);
    }
    return process.env[envKey] ?? defaultVal;
  }

  buildTrackingPixelUrl(trackingId: string): string {
    return `${this.appBaseUrl}/api/v1/email/track/${trackingId}`;
  }

  buildNotificationHtml(ctx: Omit<NotificationEmailContext, 'appBaseUrl'>): string {
    return buildNotificationEmailHtml({ ...ctx, appBaseUrl: this.appBaseUrl });
  }

  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
    // "from" address: DB setting → env var → default
    const from = this.cfg('email.fromAddress', 'EMAIL_FROM', 'noreply@resolveiq.com');

    try {
      if (process.env.SENDGRID_API_KEY) {
        const [response] = await sgMail.send({ ...options, from });
        return { success: true, messageId: response.headers['x-message-id'] as string };
      }

      // Nodemailer (dev / SMTP) — reads host/port/auth from DB settings first
      const host = this.cfg('email.smtpHost', 'SMTP_HOST', 'localhost');
      const port = parseInt(this.cfg('email.smtpPort', 'SMTP_PORT', '587'), 10);
      const user = this.cfg('email.smtpUser', 'SMTP_USER', '');
      const pass = this.cfg('email.smtpPass', 'SMTP_PASS', '');

      this.logger.debug(`Sending email via SMTP ${host}:${port} → ${options.to}`);

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: false,
        auth: user ? { user, pass } : undefined,
      });

      const info = await transporter.sendMail({ from, ...options });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      this.logger.error(`Failed to send email to ${options.to}`, err);
      return { success: false };
    }
  }
}
