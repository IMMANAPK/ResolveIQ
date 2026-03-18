import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';

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

export interface ComplaintRouting {
  committee: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

// Must match exactly what is stored in user.department
const COMMITTEES = [
  "Women's Safety Committee",
  "Cleaning Committee",
  "General Committee",
  "Food Committee",
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Groq;

  constructor() {
    this.client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }

  determineTone(priority: string, reminderCount: number): ReminderTone {
    if (priority === 'critical') return 'critical';
    if (priority === 'high' && reminderCount >= 1) return 'urgent';
    if (reminderCount >= 2) return 'urgent';
    if (priority === 'high') return 'urgent';
    if (priority === 'medium' && reminderCount >= 1) return 'urgent';
    return 'polite';
  }

  /**
   * Groq AI analyses the complaint title + description and returns
   * which committee should handle it, plus a short reason.
   * Falls back to "General Committee" on any error.
   */
  async routeComplaint(title: string, description: string): Promise<ComplaintRouting> {
    const prompt = `You are a complaint routing assistant for a corporate complaint management system called ResolveIQ.

Available committees:
${COMMITTEES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Committee responsibilities:
- Women's Safety Committee: workplace harassment, gender discrimination, personal safety, sexual misconduct, unsafe behaviour toward women
- Cleaning Committee: cleanliness, hygiene, sanitation, waste, dirty spaces, pest control
- General Committee: IT issues, laptop, computer, software, hardware, internet, general office issues, HR, payroll, leave, facilities, noise, maintenance, anything not covered above
- Food Committee: cafeteria, food quality, canteen, meals, catering, drinking water, vending machines

Complaint to route:
Title: ${title}
Description: ${description}

Respond ONLY with this exact JSON (no markdown fences, no extra text):
{"committee":"<exact committee name from list>","reason":"<one sentence why>","confidence":"high|medium|low"}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 150,
        temperature: 0.1,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      this.logger.log(`Groq routing response: ${raw}`);

      // Strip any accidental markdown code fences
      const cleaned = raw.replace(/```json?|```/g, '').trim();
      const parsed = JSON.parse(cleaned) as ComplaintRouting;

      const matched = COMMITTEES.find(
        (c) => c.toLowerCase() === parsed.committee?.toLowerCase(),
      );
      if (!matched) {
        this.logger.warn(`Groq returned unknown committee "${parsed.committee}", falling back to General Committee`);
        return { committee: 'General Committee', reason: 'Defaulted: unrecognised committee from AI', confidence: 'low' };
      }

      return { ...parsed, committee: matched };
    } catch (err) {
      this.logger.error('Groq routing call failed, falling back to General Committee', err);
      return { committee: 'General Committee', reason: 'AI routing unavailable', confidence: 'low' };
    }
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
      const completion = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 512,
        messages: [{ role: 'user', content: this.buildReminderPrompt(ctx) }],
      });

      const text = completion.choices[0]?.message?.content?.trim() ?? '';
      const lines = text.split('\n');
      const subjectLine = lines.find((l) => l.startsWith('Subject:'));
      const subject = subjectLine?.replace('Subject:', '').trim() ?? `[Reminder] Action Required: ${ctx.complaintTitle}`;
      const bodyStart = lines.findIndex((l) => l.startsWith('Subject:')) + 2;
      const body = lines.slice(bodyStart).join('\n').trim();

      return { subject, body, tone: ctx.tone };
    } catch (err) {
      this.logger.error('Groq reminder generation failed, using fallback', err);
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
