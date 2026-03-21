import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import { CommitteesService } from '../committees/committees.service';
import { SettingsService } from '../settings/settings.service';
import { SentimentLabel } from '../complaints/entities/complaint.entity';

export type ReminderTone = 'polite' | 'urgent' | 'critical';
export type EscalationDecisionStep = 'reminder' | 'reroute' | 'multi_channel' | 'skip';

export interface EscalationDecision {
  shouldEscalate: boolean;
  step: EscalationDecisionStep;
  reason: string;
}

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

  async decideEscalationAction(context: {
    complaintTitle: string;
    complaintDescription: string;
    priority: string;
    ageMinutes: number;
    reminderCount: number;
  }): Promise<EscalationDecision> {
    const { complaintTitle, complaintDescription, priority, ageMinutes, reminderCount } = context;
    const hoursElapsed = (ageMinutes / 60).toFixed(1);

    const prompt = `You are an AI escalation advisor for a complaint management system called ResolveIQ.

A complaint has not been acknowledged by the assigned committee members. Decide what escalation action to take RIGHT NOW.

Complaint Details:
- Title: ${complaintTitle}
- Description: ${complaintDescription}
- Priority: ${priority.toUpperCase()}
- Time since notification was sent: ${hoursElapsed} hours (${ageMinutes} minutes)
- Number of reminders already sent: ${reminderCount}

Escalation steps available:
- "reminder": Send another email reminder to the original recipients (appropriate for early-stage, low reminder counts)
- "reroute": Re-route the complaint to other available committee members (appropriate when original recipients are clearly unresponsive)
- "multi_channel": Trigger critical push notifications and in-app alerts (appropriate for critical/high priority complaints with long delays)
- "skip": Do nothing yet, it is too early or not urgent enough to escalate

Decision rules to consider:
- Critical priority complaints should escalate faster
- If reminderCount >= 3, prefer reroute or multi_channel over another reminder
- If ageMinutes < 30 and priority is low/medium, prefer skip
- Use multi_channel only when the situation is truly urgent (high priority + long delay, or critical priority)

Respond in JSON format ONLY (no explanation outside JSON):
{"shouldEscalate": true/false, "step": "reminder|reroute|multi_channel|skip", "reason": "one sentence explanation"}`;

    try {
      const response = await this.getGroqClient().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content?.trim() ?? '';
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      const step: EscalationDecisionStep = ['reminder', 'reroute', 'multi_channel', 'skip'].includes(parsed.step)
        ? parsed.step
        : 'reminder';
      return {
        shouldEscalate: parsed.shouldEscalate !== false && step !== 'skip',
        step,
        reason: parsed.reason ?? 'AI escalation decision',
      };
    } catch (err) {
      this.logger.error('AI escalation decision failed, using fallback logic', err);
      return this.fallbackEscalationDecision(priority, ageMinutes, reminderCount);
    }
  }

  async analyzeSentiment(complaint: { title: string; description: string }): Promise<{
    label: SentimentLabel;
    score: number;
    confidence: number;
  }> {
    const prompt = `You are a sentiment analysis assistant for a complaint management system.

Analyze the emotional tone of this complaint and classify it.

Complaint Title: ${complaint.title}
Complaint Description: ${complaint.description}

Classify into exactly ONE of these labels:
- "frustrated": The person is annoyed or exasperated
- "angry": The person is upset or hostile
- "neutral": The person is stating facts without strong emotion
- "concerned": The person is worried but reasonable
- "satisfied": The person is generally positive (rare in complaints)

Also provide:
- "score": A number from 0.0 (very negative) to 1.0 (very positive)
- "confidence": A number from 0.0 to 1.0 indicating how confident you are

Respond in JSON format ONLY:
{"label": "one_of_the_labels", "score": 0.0-1.0, "confidence": 0.0-1.0}`;

    try {
      const response = await this.getGroqClient().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.1,
      });

      const text = response.choices[0]?.message?.content?.trim() ?? '';
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleaned);

      const validLabels: SentimentLabel[] = ['frustrated', 'angry', 'neutral', 'concerned', 'satisfied'];
      const label: SentimentLabel = validLabels.includes(parsed.label) ? parsed.label : 'neutral';
      const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(1, parsed.score)) : 0.5;
      const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;

      return { label, score, confidence };
    } catch (err) {
      this.logger.error('AI sentiment analysis failed, using fallback', err);
      return { label: 'neutral', score: 0.5, confidence: 0 };
    }
  }

  async summarizeFeedback(context: {
    complaintTitle: string;
    rating: number;
    comment: string;
  }): Promise<string> {
    const prompt = `You are a feedback summarizer for a complaint management system.

A complainant has provided feedback on the resolution of their complaint.

Complaint Title: ${context.complaintTitle}
Rating: ${context.rating}/5 stars
Comment: ${context.comment}

Write a ONE sentence summary that captures the key sentiment and any actionable insight from this feedback. Be concise and professional.

Respond with ONLY the summary sentence, no labels or formatting.`;

    try {
      const response = await this.getGroqClient().chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.3,
      });

      const summary = response.choices[0]?.message?.content?.trim();
      if (!summary) throw new Error('Empty response');
      return summary;
    } catch (err) {
      this.logger.error('AI feedback summary failed', err);
      throw err; // caller handles fallback (leaves aiSummary null)
    }
  }

  private fallbackEscalationDecision(
    priority: string,
    ageMinutes: number,
    reminderCount: number,
  ): EscalationDecision {
    if (ageMinutes >= 360 || (priority === 'critical' && ageMinutes >= 120)) {
      return { shouldEscalate: true, step: 'multi_channel', reason: 'Fallback: critical threshold reached' };
    }
    if (ageMinutes >= 180 || (priority === 'high' && ageMinutes >= 90 && reminderCount >= 1)) {
      return { shouldEscalate: true, step: 'reroute', reason: 'Fallback: reroute threshold reached' };
    }
    if (ageMinutes >= 60) {
      return { shouldEscalate: true, step: 'reminder', reason: 'Fallback: reminder threshold reached' };
    }
    return { shouldEscalate: false, step: 'skip', reason: 'Fallback: too early to escalate' };
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
