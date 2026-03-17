import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

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
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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
    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        messages: [{ role: 'user', content: this.buildReminderPrompt(ctx) }],
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      const lines = text.trim().split('\n');
      const subjectLine = lines.find((l) => l.startsWith('Subject:'));
      const subject = subjectLine?.replace('Subject:', '').trim() ?? `[Reminder] Action Required: ${ctx.complaintTitle}`;
      const bodyStart = lines.findIndex((l) => l.startsWith('Subject:')) + 2;
      const body = lines.slice(bodyStart).join('\n').trim();

      return { subject, body, tone: ctx.tone };
    } catch (err) {
      this.logger.error('AI generation failed, using fallback', err);
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
