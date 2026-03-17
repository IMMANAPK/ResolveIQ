export type Priority = "Low" | "Medium" | "High" | "Critical";
export type Status = "New" | "In Review" | "In Progress" | "Resolved" | "Escalated";
export type UserRole = "complainant" | "committee" | "admin";

export interface Recipient {
  name: string;
  seen: boolean;
  time?: string;
  avatar?: string;
}

export interface AIAction {
  id: string;
  type: "reminder" | "escalation" | "reassignment";
  message: string;
  timestamp: string;
  tone?: string;
}

export interface TimelineEvent {
  id: string;
  type: "created" | "email_sent" | "viewed" | "reminder" | "escalation" | "reassignment" | "resolved";
  description: string;
  timestamp: string;
  user?: string;
}
