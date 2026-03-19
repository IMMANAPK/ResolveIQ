import { NodeHandler } from './index';
import { NotificationType, NotificationChannel } from '../../notifications/entities/notification.entity';

/**
 * Send in-app notification to resolved recipients.
 *
 * Config fields (spec-compliant):
 *   recipientUserIds?: string[]  — explicit user IDs
 *   recipientRoles?: string[]    — role names expanded to user IDs at runtime
 *   message?: string             — notification body
 *
 * Skipped in dry-run (side-effect node).
 */
export const sendNotificationHandler: NodeHandler = async ({ config, complaint, notificationsService, usersService, dryRun }) => {
  if (dryRun) return { skipped: true };

  const directIds: string[] = (config.recipientUserIds as string[]) || [];
  const roles: string[] = (config.recipientRoles as string[]) || [];
  const message = (config.message as string) || 'Workflow Notification';

  // Expand roles → user IDs
  const roleUserIds: string[] = [];
  if (roles.length > 0) {
    const allUsers = await usersService.findAll();
    for (const user of allUsers) {
      if (user.roles?.some((r: any) => roles.includes(r as string))) {
        roleUserIds.push(user.id);
      }
    }
  }

  const recipientIds = [...new Set([...directIds, ...roleUserIds])];

  if (recipientIds.length > 0) {
    await notificationsService.createNotification({
      complaintId: complaint.id,
      type: NotificationType.ESCALATION,
      channel: NotificationChannel.IN_APP,
      subject: `Workflow: ${complaint.title}`,
      body: message,
      recipientIds,
    });
  }

  return {};
};
