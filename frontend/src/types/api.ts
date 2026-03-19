// API response types matching backend entities

export type ApiUserRole = 'admin' | 'complainant' | 'committee_member' | 'manager';

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  roles: ApiUserRole[];
  isActive: boolean;
  isAvailable: boolean;
  department?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export type ApiComplaintStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
export type ApiComplaintPriority = 'low' | 'medium' | 'high' | 'critical';
export type ApiComplaintCategory = 'hr' | 'it' | 'facilities' | 'conduct' | 'safety' | 'other';

export interface ApiComplaint {
  id: string;
  title: string;
  description: string;
  category: ApiComplaintCategory;
  priority: ApiComplaintPriority;
  status: ApiComplaintStatus;
  raisedBy: ApiUser;
  raisedById: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  aiSummary?: string;
  aiSummaryStatus?: 'pending' | 'completed' | 'failed';
  aiSummaryError?: string;
  createdAt: string;
  updatedAt: string;
}

export type ApiDeliveryStatus = 'pending' | 'sent' | 'failed' | 'read';

export interface ApiRecipient {
  id: string;
  /** backend entity field — matches NotificationRecipient.recipientId */
  recipientId: string;
  /** populated when backend loads relations: ['recipients.recipient'] */
  recipient?: ApiUser;
  deliveryStatus: ApiDeliveryStatus;
  trackingId: string;
  isRead: boolean;
  readAt?: string;
  reminderCount: number;
}

export type ApiNotificationType = 'initial' | 'reminder' | 'escalation' | 're_routed';
export type ApiNotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

export interface ApiNotification {
  id: string;
  complaintId: string;
  complaint?: ApiComplaint;
  type: ApiNotificationType;
  channel: ApiNotificationChannel;
  allRead: boolean;
  recipients: ApiRecipient[];
  createdAt: string;
  updatedAt: string;
}

export type ApiEscalationStep = 'reminder' | 'reroute' | 'multi_channel';
/** Matches EscalationStatus enum on the backend entity */
export type ApiEscalationStatus = 'triggered' | 'completed' | 'failed';

export interface ApiEscalationLog {
  id: string;
  complaintId: string;
  /** FK to the original notification that triggered this escalation */
  originalNotificationId: string;
  targetUserId: string;
  step: ApiEscalationStep;
  status: ApiEscalationStatus;
  metadata?: Record<string, unknown>;
  aiGeneratedSubject?: string;
  aiGeneratedBody?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCommittee {
  id: string;
  name: string;
  description?: string;
  categories: ApiComplaintCategory[];
  managerId?: string;
  manager?: ApiUser;
  createdAt: string;
  updatedAt: string;
}

export interface ApiNotificationRule {
  id: string;
  committeeId: string;
  type: 'default' | 'conditional';
  condition?: { field: 'priority' | 'category'; op: 'eq' | 'neq'; value: string };
  recipientUserIds: string[];
  recipientRoles: string[];
  order: number;
}

export interface LoginResponse {
  accessToken: string;
  user: ApiUser;
}

export interface ApiWorkflowNode {
  id: string;
  type: 'trigger' | 'ai_prompt' | 'condition' | 'send_notification' | 'send_email' | 'update_complaint' | 'delay';
  config: Record<string, unknown>;
  position?: { x: number; y: number }; 
}

export interface ApiWorkflowEdge {
  from: string;
  to: string;
  condition?: 'true' | 'false';
}

export interface ApiWorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  trigger: { type: 'event' | 'manual'; event?: string };
  definition: { schemaVersion: number; nodes: ApiWorkflowNode[]; edges: ApiWorkflowEdge[] };
  schemaVersion: number;
  definitionVersion: number;
  isActive: boolean;
  maxRunDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export type ApiWorkflowRunStatus = 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

export interface ApiWorkflowRun {
  id: string;
  workflowId: string;
  definitionVersion: number;
  complaintId: string;
  status: ApiWorkflowRunStatus;
  triggeredBy: 'event' | 'manual';
  context: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export interface ApiWorkflowStepLog {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  skippedReason?: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// Display mappers
export const STATUS_LABELS: Record<ApiComplaintStatus, string> = {
  open: 'New',
  assigned: 'In Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Resolved',
};

export const PRIORITY_LABELS: Record<ApiComplaintPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const CATEGORY_LABELS: Record<ApiComplaintCategory, string> = {
  hr: 'HR',
  it: 'IT',
  facilities: 'Facilities',
  conduct: 'Conduct',
  safety: 'Safety',
  other: 'Other',
};
