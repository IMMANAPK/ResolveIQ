// API response types matching backend entities

export type ApiUserRole = 'admin' | 'complainant' | 'committee_member' | 'manager';

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  role: ApiUserRole;
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
  createdAt: string;
  updatedAt: string;
}

export type ApiDeliveryStatus = 'pending' | 'sent' | 'failed' | 'read';

export interface ApiRecipient {
  id: string;
  userId: string;
  user: ApiUser;
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
export type ApiEscalationStatus = 'pending' | 'sent' | 'failed';

export interface ApiEscalationLog {
  id: string;
  notificationId: string;
  step: ApiEscalationStep;
  status: ApiEscalationStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  user: ApiUser;
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
