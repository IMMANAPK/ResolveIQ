import { NodeHandler } from './index';

/**
 * Send email to resolved recipients.
 *
 * Config fields (spec-compliant):
 *   recipientUserIds?: string[]  — explicit user IDs (resolved to email addresses)
 *   recipientRoles?: string[]    — role names expanded to users at runtime
 *   subject: string
 *   body: string
 *
 * Skipped in dry-run (side-effect node).
 */
export const sendEmailHandler: NodeHandler = async ({ config, complaint, emailService, usersService, dryRun }) => {
  if (dryRun) return { skipped: true };

  const directIds: string[] = (config.recipientUserIds as string[]) || [];
  const roles: string[] = (config.recipientRoles as string[]) || [];
  const subject = (config.subject as string) || `Workflow: ${complaint.title}`;
  const body = (config.body as string) || '';

  // Fetch users only when needed
  const allUsers = (directIds.length > 0 || roles.length > 0)
    ? await usersService.findAll()
    : [];

  const recipients = allUsers.filter(
    (u) =>
      directIds.includes(u.id) ||
      (roles.length > 0 && u.roles?.some((r: any) => roles.includes(r as string))),
  );

  for (const user of recipients) {
    if (user.email) {
      await emailService.sendEmail({ to: user.email, subject, html: body });
    }
  }

  return {};
};
