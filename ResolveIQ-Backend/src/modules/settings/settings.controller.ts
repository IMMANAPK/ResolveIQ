import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IsOptional, IsString, IsNumber } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional() @IsString() 'ai.groqApiKey'?: string;
  @IsOptional() @IsNumber() 'ai.routingConfidenceThreshold'?: number;
  @IsOptional() @IsString() 'email.smtpHost'?: string;
  @IsOptional() @IsNumber() 'email.smtpPort'?: number;
  @IsOptional() @IsString() 'email.smtpUser'?: string;
  @IsOptional() @IsString() 'email.smtpPass'?: string;
  @IsOptional() @IsString() 'email.fromAddress'?: string;
  @IsOptional() @IsString() 'cloudinary.cloudName'?: string;
  @IsOptional() @IsString() 'cloudinary.apiKey'?: string;
  @IsOptional() @IsString() 'cloudinary.apiSecret'?: string;
}

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly aiService: AiService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  async getSettings() {
    const keys = [
      'ai.groqApiKey',
      'ai.routingConfidenceThreshold',
      'email.smtpHost',
      'email.smtpPort',
      'email.smtpUser',
      'email.smtpPass',
      'email.fromAddress',
      'cloudinary.cloudName',
      'cloudinary.apiKey',
      'cloudinary.apiSecret',
    ];
    const settings = await this.settingsService.getMultiple(keys);
    for (const k of keys) {
      if (this.settingsService.isKeyEncrypted(k) && settings[k]) {
        settings[k] = '********';
      }
    }
    return settings;
  }

  @Put()
  async updateSettings(@Body() body: Record<string, any>) {
    const records = body;
    
    for (const key of Object.keys(records)) {
      const value = records[key];
      if (value === '********' || value === undefined || value === null || value === '') continue;

      const isSensitive = key.toLowerCase().includes('key') || key.toLowerCase().includes('pass') || key.toLowerCase().includes('secret');
      await this.settingsService.set(key, value, isSensitive);
    }
    return { success: true };
  }

  @Post('test-ai')
  async testAi() {
    const start = Date.now();
    try {
      const summary = await this.aiService.generateSummary({
        title: 'Test Complaint',
        description: 'This is a test complaint to verify the AI configuration works properly. Please summarize it concisely.',
        category: 'other',
        priority: 'medium',
      });
      const timeMs = Date.now() - start;
      return { success: true, summary, timeMs };
    } catch (err: any) {
      const timeMs = Date.now() - start;
      return { success: false, error: err.message, timeMs };
    }
  }

  @Post('test-cloudinary')
  async testCloudinary() {
    const start = Date.now();
    try {
      const { v2: cloudinary } = await import('cloudinary');
      cloudinary.config({
        cloud_name: this.settingsService.get('cloudinary.cloudName') || process.env.CLOUDINARY_CLOUD_NAME,
        api_key: this.settingsService.get('cloudinary.apiKey') || process.env.CLOUDINARY_API_KEY,
        api_secret: this.settingsService.get('cloudinary.apiSecret') || process.env.CLOUDINARY_API_SECRET,
      });
      const result = await cloudinary.api.ping();
      return { success: true, timeMs: Date.now() - start, detail: result };
    } catch (err: any) {
      return { success: false, timeMs: Date.now() - start, error: err.message || JSON.stringify(err) };
    }
  }

  @Post('test-email')
  async testEmail(@Body() body: { to: string }) {
    const start = Date.now();
    try {
      if (!body.to) throw new Error('Recipient email is required');
      await this.emailService.sendEmail({
        to: body.to,
        subject: 'ResolveIQ - Test Email',
        html: '<p>If you are receiving this, your SMTP settings are configured correctly!</p>'
      });
      const timeMs = Date.now() - start;
      return { success: true, timeMs };
    } catch (err: any) {
      const timeMs = Date.now() - start;
      return { success: false, error: err.message, timeMs };
    }
  }
}
