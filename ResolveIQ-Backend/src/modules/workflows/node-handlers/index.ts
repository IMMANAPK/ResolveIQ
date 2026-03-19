import { Complaint } from '../../complaints/entities/complaint.entity';
import { AiService } from '../../ai/ai.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../email/email.service';
import { UsersService } from '../../users/users.service';
import { Repository } from 'typeorm';

export interface NodeHandlerContext {
  runContext: Record<string, unknown>;
  complaint: Complaint;
  config: Record<string, unknown>;
  dryRun: boolean;

  // Dependencies injected by processor
  aiService: AiService;
  notificationsService: NotificationsService;
  emailService: EmailService;
  usersService: UsersService;
  complaintRepo: Repository<Complaint>;
}

export interface NodeHandlerResult {
  output?: Record<string, unknown>;
  conditionResult?: boolean;
  delayMs?: number;
  skipped?: boolean;
}

export type NodeHandler = (ctx: NodeHandlerContext) => Promise<NodeHandlerResult>;
