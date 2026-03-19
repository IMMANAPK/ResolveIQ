import { NodeHandler } from './index';

/**
 * AI Prompt handler.
 *
 * Config fields:
 *   promptSlug: 'summarize' | string  — built-in slug or free-form prompt template
 *   prompt?: string                   — literal prompt text (used when promptSlug is unrecognised)
 *   outputVar?: string                — context key to store the AI output (default: 'ai_output')
 *
 * Dry-run: executes the real Groq call (per spec — AI nodes are never skipped in dry-run).
 * Side-effect nodes (send_notification, send_email, update_complaint) are skipped instead.
 */
export const aiPromptHandler: NodeHandler = async ({ config, complaint, runContext, aiService }) => {
  const promptSlug = config.promptSlug as string;
  const outputVar = (config.outputVar as string) || 'ai_output';

  let resultText = '';

  if (promptSlug === 'summarize') {
    resultText = await aiService.generateSummary({
      title: complaint.title,
      description: complaint.description,
      category: complaint.category,
      priority: complaint.priority,
    });
  } else {
    // Support a free-form prompt template with context variable interpolation.
    // Template syntax: {{variableName}} is replaced by the value from runContext.
    const rawPrompt = (config.prompt as string) || `Analyse the following complaint and respond concisely.\n\nTitle: ${complaint.title}\nDescription: ${complaint.description}`;
    const interpolated = rawPrompt.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => {
      const val = runContext[key];
      return val !== undefined ? String(val) : `{{${key}}}`;
    });

    const result = await aiService.routeComplaintWithConfidence({
      title: complaint.title,
      description: complaint.description,
      aiSummary: interpolated,
    });
    // For generic prompts, return the full result as JSON
    resultText = JSON.stringify(result);
  }

  return { output: { [outputVar]: resultText } };
};
