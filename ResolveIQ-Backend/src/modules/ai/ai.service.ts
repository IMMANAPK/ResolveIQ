import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { CommitteesService } from '../committees/committees.service';
import { SettingsService } from '../settings/settings.service';

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

  constructor(
    private readonly committeesService: CommitteesService,
    private readonly settingsService: SettingsService,
  ) {}

  private getGroqClient(): Groq {
    const apiKey = this.settingsService.get<string>('ai.groqApiKey') || process.env.GROQ_API_KEY;
    if (!apiKey) {
      this.logger.warn('Groq API Key is not configured.');
      throw new Error('Groq API Key missing. Please configure it in System Settings.');
    }
    return new Groq({ apiKey });
  }

  determineTone(priority: string, reminderCount: number): ReminderTone {
    if (priority === 'critical') return 'critical';
    if (priority === 'high' && reminderCount >= 1) return 'urgent';
    if (reminderCount >= 2) return 'urgent';
    if (priority === 'high') return 'urgent';
    if (priority === 'medium' && reminderCount >= 1) return 'urgent';
    return 'polite';
  }

  async routeComplaintWithConfidence(complaint: {
    title: string;
    description: string;
    aiSummary?: string;
  }): Promise<{ committee: string; confidence: number; reason: string }> {
    const committees = await this.committeesService.getCommitteesForAi();
    if (committees.length === 0) {
      return { committee: 'General Committee', confidence: 0, reason: 'No committees configured' };
    }

    const committeeList = committees
      .map((c) => `- ${c.name}: ${c.description || 'No description'} (categories: ${c.categories.join(', ') || 'none'})`)
      .join('\n');

    const summaryContext = complaint.aiSummary ? `\nAI Summary: ${complaint.aiSummary}` : '';

    const prompt = `You are a complaint routing assistant. Route this complaint to the most appropriate committee.

Available Committees:
${committeeList}

Complaint Title: ${complaint.title}
Complaint Description: ${complaint.description}${summaryContext}

Respond in JSON format ONLY:
{"committee": "Committee Name", "confidence": 0.0-1.0, "reason": "one sentence explanation"}`;

    const response = await this.getGroqClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    try {
      const parsed = JSON.parse(text);
      return {
        committee: parsed.committee ?? 'General Committee',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        reason: parsed.reason ?? 'AI routing',
      };
    } catch {
      return { committee: 'General Committee', confidence: 0, reason: 'Failed to parse AI response' };
    }
  }

  async generateSummary(complaint: {
    title: string;
    description: string;
    category: string;
    priority: string;
  }): Promise<string> {
    const prompt = `You are a complaint summarizer. Generate a concise 2-3 sentence summary of this complaint for internal review.

Title: ${complaint.title}
Category: ${complaint.category}
Priority: ${complaint.priority}
Description: ${complaint.description}

Respond with ONLY the summary text, no labels or formatting.`;

    const response = await this.getGroqClient().chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
      temperature: 0.3,
    });

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) throw new Error('AI returned empty summary');
    return summary;
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
      const completion = await this.getGroqClient().chat.completions.create({
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
