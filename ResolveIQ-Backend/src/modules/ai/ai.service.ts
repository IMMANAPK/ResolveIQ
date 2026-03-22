import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

export type ReminderTone = 'polite' | 'urgent' | 'critical';

export interface ReminderPromptContext {
  recipientName: string;
  complaintTitle: string;
  complaintDescription: string;
  priority: string;
  tone: ReminderTone;
  reminderCount: number;
  hoursElapsed: number;
}

export interface GeneratedReminder {
  subject: string;
  body: string;
  tone: ReminderTone;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY not found in environment variables');
    }
  }

  determineTone(priority: string, reminderCount: number): ReminderTone {
    if (priority === 'critical') return 'critical';
    if (priority === 'high' && reminderCount >= 1) return 'urgent';
    if (reminderCount >= 2) return 'urgent';
    if (priority === 'high') return 'urgent';
    if (priority === 'medium' && reminderCount >= 1) return 'urgent';
    return 'polite';
  }

  buildReminderPrompt(ctx: ReminderPromptContext): string {
    return `You are an AI assistant for a corporate complaint management system called ResolveIQ.

Generate a follow-up notification email for a committee member who has not yet viewed a complaint notification.

Context:
- Recipient: ${ctx.recipientName}
- Complaint Title: ${ctx.complaintTitle}
- Complaint Description: ${ctx.complaintDescription}
- Priority: ${ctx.priority.toUpperCase()}
- Tone required: ${ctx.tone}
- This is reminder #${ctx.reminderCount + 1}
- Hours since original notification: ${ctx.hoursElapsed}

Instructions:
1. Write a subject line (prefix with "Subject: ")
2. Write an email body that:
   - Addresses the recipient by name
   - Briefly describes the pending complaint
   - Communicates appropriate urgency based on tone: polite=friendly reminder, urgent=action required, critical=immediate action required
   - Includes a clear call-to-action
   - Is professional and concise (max 150 words)

Respond in this format:
Subject: <subject line>

<email body>`;
  }

  async generateReminderEmail(ctx: ReminderPromptContext): Promise<GeneratedReminder> {
    if (!this.genAI) {
      this.logger.error('Gemini AI not initialized (missing API key)');
      return this.fallbackReminder(ctx);
    }

    try {
      // Using 'gemini-pro' as it has wider availability across all API versions
      const model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
      const result = await model.generateContent(this.buildReminderPrompt(ctx));
      const response = await result.response;
      const text = response.text();

      const lines = text.trim().split('\n');
      const subjectLine = lines.find((l) => l.toLowerCase().startsWith('subject:'));
      const subject = subjectLine?.replace(/subject:/i, '').trim() ?? `[Reminder] Action Required: ${ctx.complaintTitle}`;
      
      const subjectIndex = lines.findIndex((l) => l.toLowerCase().startsWith('subject:'));
      // Extract body: take everything after the subject line, filter out empty lines at start
      const bodyLines = lines.slice(subjectIndex !== -1 ? subjectIndex + 1 : 0);
      const body = bodyLines.join('\n').trim();

      return { subject, body, tone: ctx.tone };
    } catch (err) {
      this.logger.error('Gemini AI generation failed, using fallback', err);
      return this.fallbackReminder(ctx);
    }
  }

  private fallbackReminder(ctx: ReminderPromptContext): GeneratedReminder {
    const toneMap: Record<ReminderTone, string> = {
      polite: 'This is a friendly reminder',
      urgent: 'URGENT: Immediate action required',
      critical: 'CRITICAL: This requires your immediate attention',
    };
    return {
      subject: `[${ctx.priority.toUpperCase()}] Reminder: ${ctx.complaintTitle}`,
      body: `Dear ${ctx.recipientName},\n\n${toneMap[ctx.tone]} regarding complaint "${ctx.complaintTitle}".\n\nThis complaint has been pending for ${ctx.hoursElapsed} hours and requires your review.\n\nPlease log in to ResolveIQ to take action.\n\nThank you.`,
      tone: ctx.tone,
    };
  }
}
