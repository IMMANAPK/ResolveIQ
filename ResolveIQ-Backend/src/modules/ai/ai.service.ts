import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { CommitteesService } from '../committees/committees.service';

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

// Fallback hardcoded list used only when DB has no committees yet
const FALLBACK_COMMITTEES = [
  "Women's Safety Committee",
  "Cleaning Committee",
  "General Committee",
  "Food Committee",
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Groq;

  constructor(private readonly committeesService: CommitteesService) {
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
   * Routes a complaint to the correct committee.
   * 1. Loads committees + descriptions from DB
   * 2. Sends to Groq AI for routing
   * 3. Falls back to "General Committee" on any error
   */
  async routeComplaint(title: string, description: string): Promise<ComplaintRouting> {
    // Load live committees from DB
    let dbCommittees = await this.committeesService.getCommitteesForAi();
    const committeeNames = dbCommittees.length > 0
      ? dbCommittees.map((c) => c.name)
      : FALLBACK_COMMITTEES;

    const fallback = committeeNames.find((n) => n.toLowerCase().includes('general')) ?? committeeNames[0] ?? 'General Committee';

    const committeeList = dbCommittees.length > 0
      ? dbCommittees.map((c, i) => {
          const cats = c.categories.length > 0 ? ` (handles: ${c.categories.join(', ')})` : '';
          const desc = c.description ? ` — ${c.description}` : '';
          return `${i + 1}. ${c.name}${cats}${desc}`;
        }).join('\n')
      : FALLBACK_COMMITTEES.map((c, i) => `${i + 1}. ${c}`).join('\n');

    const prompt = `You are a complaint routing assistant for a corporate complaint management system called ResolveIQ.

Available committees:
${committeeList}

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

      const cleaned = raw.replace(/```json?|```/g, '').trim();
      const parsed = JSON.parse(cleaned) as ComplaintRouting;

      const matched = committeeNames.find(
        (c) => c.toLowerCase() === parsed.committee?.toLowerCase(),
      );
      if (!matched) {
        this.logger.warn(`Groq returned unknown committee "${parsed.committee}", falling back to ${fallback}`);
        return { committee: fallback, reason: 'Defaulted: unrecognised committee from AI', confidence: 'low' };
      }

      return { ...parsed, committee: matched };
    } catch (err) {
      this.logger.error('Groq routing call failed, falling back to ' + fallback, err);
      return { committee: fallback, reason: 'AI routing unavailable', confidence: 'low' };
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
