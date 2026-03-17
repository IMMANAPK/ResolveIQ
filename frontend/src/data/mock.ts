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

export interface Complaint {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  updatedAt: string;
  recipients: Recipient[];
  aiActions: AIAction[];
  timeline: TimelineEvent[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  priority: Priority;
  complaintId: string;
}

export interface AdminLog {
  id: string;
  action: string;
  target: string;
  user: string;
  timestamp: string;
  type: "email" | "view" | "reminder" | "reassignment" | "escalation";
}

export const complaints: Complaint[] = [
  {
    id: "CMP-101",
    title: "Water Leakage in Building A",
    description: "Persistent water leakage from the ceiling in the 3rd floor corridor of Building A. The issue has been ongoing for two weeks and is causing damage to the flooring and electrical fixtures nearby.",
    category: "Infrastructure",
    priority: "High",
    status: "In Review",
    createdAt: "2026-03-14T09:30:00Z",
    updatedAt: "2026-03-17T10:32:00Z",
    recipients: [
      { name: "John Doe", seen: true, time: "10:32 AM" },
      { name: "Sara Khan", seen: false },
      { name: "Alex Rivera", seen: true, time: "09:50 AM" },
      { name: "Priya Sharma", seen: false },
    ],
    aiActions: [
      { id: "ai-1", type: "reminder", message: "AI Reminder Sent (Polite Tone)", timestamp: "2026-03-16T14:00:00Z", tone: "Polite" },
      { id: "ai-2", type: "escalation", message: "Escalation Triggered — 48h unviewed", timestamp: "2026-03-17T09:00:00Z" },
    ],
    timeline: [
      { id: "t1", type: "created", description: "Complaint created by Resident #42", timestamp: "2026-03-14T09:30:00Z" },
      { id: "t2", type: "email_sent", description: "Email sent to 4 committee members", timestamp: "2026-03-14T09:31:00Z" },
      { id: "t3", type: "viewed", description: "Viewed by Alex Rivera", timestamp: "2026-03-14T09:50:00Z", user: "Alex Rivera" },
      { id: "t4", type: "viewed", description: "Viewed by John Doe", timestamp: "2026-03-14T10:32:00Z", user: "John Doe" },
      { id: "t5", type: "reminder", description: "AI Reminder sent to Sara Khan (Polite Tone)", timestamp: "2026-03-16T14:00:00Z" },
      { id: "t6", type: "escalation", description: "Escalation triggered — 2 members unresponsive after 48h", timestamp: "2026-03-17T09:00:00Z" },
    ],
  },
  {
    id: "CMP-102",
    title: "Noise Complaint — Unit 12B",
    description: "Repeated late-night noise disturbances from Unit 12B, affecting multiple neighboring residents. Issue has been reported verbally multiple times without resolution.",
    category: "Noise",
    priority: "Medium",
    status: "In Progress",
    createdAt: "2026-03-15T11:00:00Z",
    updatedAt: "2026-03-17T08:00:00Z",
    recipients: [
      { name: "John Doe", seen: true, time: "11:15 AM" },
      { name: "Maria Lopez", seen: true, time: "12:00 PM" },
      { name: "Raj Patel", seen: false },
    ],
    aiActions: [
      { id: "ai-3", type: "reminder", message: "AI Reminder Sent (Firm Tone)", timestamp: "2026-03-17T08:00:00Z", tone: "Firm" },
    ],
    timeline: [
      { id: "t7", type: "created", description: "Complaint created by Resident #18", timestamp: "2026-03-15T11:00:00Z" },
      { id: "t8", type: "email_sent", description: "Email sent to 3 committee members", timestamp: "2026-03-15T11:01:00Z" },
      { id: "t9", type: "viewed", description: "Viewed by John Doe", timestamp: "2026-03-15T11:15:00Z", user: "John Doe" },
      { id: "t10", type: "viewed", description: "Viewed by Maria Lopez", timestamp: "2026-03-15T12:00:00Z", user: "Maria Lopez" },
      { id: "t11", type: "reminder", description: "AI Reminder sent to Raj Patel (Firm Tone)", timestamp: "2026-03-17T08:00:00Z" },
    ],
  },
  {
    id: "CMP-103",
    title: "Broken Elevator — Tower C",
    description: "The main elevator in Tower C has been non-functional for 3 days. Elderly residents are severely impacted.",
    category: "Infrastructure",
    priority: "Critical",
    status: "Escalated",
    createdAt: "2026-03-13T08:00:00Z",
    updatedAt: "2026-03-16T16:00:00Z",
    recipients: [
      { name: "Sara Khan", seen: true, time: "08:15 AM" },
      { name: "Alex Rivera", seen: true, time: "08:30 AM" },
      { name: "John Doe", seen: true, time: "09:00 AM" },
      { name: "Priya Sharma", seen: true, time: "09:10 AM" },
    ],
    aiActions: [
      { id: "ai-4", type: "escalation", message: "Auto-escalated to Admin — Critical priority", timestamp: "2026-03-13T20:00:00Z" },
      { id: "ai-5", type: "reassignment", message: "Reassigned to Active Member (Maria Lopez)", timestamp: "2026-03-14T09:00:00Z" },
    ],
    timeline: [
      { id: "t12", type: "created", description: "Complaint created by Resident #5", timestamp: "2026-03-13T08:00:00Z" },
      { id: "t13", type: "email_sent", description: "Email sent to 4 committee members", timestamp: "2026-03-13T08:01:00Z" },
      { id: "t14", type: "viewed", description: "Viewed by Sara Khan", timestamp: "2026-03-13T08:15:00Z", user: "Sara Khan" },
      { id: "t15", type: "viewed", description: "Viewed by Alex Rivera", timestamp: "2026-03-13T08:30:00Z", user: "Alex Rivera" },
      { id: "t16", type: "escalation", description: "Auto-escalated to Admin — Critical priority unresolved", timestamp: "2026-03-13T20:00:00Z" },
      { id: "t17", type: "reassignment", description: "Reassigned to Maria Lopez (Active Member)", timestamp: "2026-03-14T09:00:00Z" },
      { id: "t18", type: "resolved", description: "Elevator repair completed", timestamp: "2026-03-16T16:00:00Z" },
    ],
  },
  {
    id: "CMP-104",
    title: "Parking Violation — Spot 45",
    description: "Unauthorized vehicle parked in reserved spot #45 for the past week. Multiple attempts to contact the owner have failed.",
    category: "Parking",
    priority: "Low",
    status: "New",
    createdAt: "2026-03-17T07:00:00Z",
    updatedAt: "2026-03-17T07:00:00Z",
    recipients: [
      { name: "John Doe", seen: false },
      { name: "Maria Lopez", seen: false },
    ],
    aiActions: [],
    timeline: [
      { id: "t19", type: "created", description: "Complaint created by Resident #31", timestamp: "2026-03-17T07:00:00Z" },
      { id: "t20", type: "email_sent", description: "Email sent to 2 committee members", timestamp: "2026-03-17T07:01:00Z" },
    ],
  },
  {
    id: "CMP-105",
    title: "Security Camera Malfunction — Gate B",
    description: "Security camera at Gate B has been showing a black screen intermittently for the past 5 days. This is a significant security concern.",
    category: "Security",
    priority: "High",
    status: "In Review",
    createdAt: "2026-03-12T14:00:00Z",
    updatedAt: "2026-03-17T11:00:00Z",
    recipients: [
      { name: "Priya Sharma", seen: true, time: "02:30 PM" },
      { name: "Raj Patel", seen: false },
      { name: "Alex Rivera", seen: true, time: "03:00 PM" },
    ],
    aiActions: [
      { id: "ai-6", type: "reminder", message: "AI Reminder Sent (Polite Tone)", timestamp: "2026-03-15T10:00:00Z", tone: "Polite" },
      { id: "ai-7", type: "reminder", message: "AI Follow-up Reminder (Firm Tone)", timestamp: "2026-03-17T10:00:00Z", tone: "Firm" },
    ],
    timeline: [
      { id: "t21", type: "created", description: "Complaint created by Security Team", timestamp: "2026-03-12T14:00:00Z" },
      { id: "t22", type: "email_sent", description: "Email sent to 3 committee members", timestamp: "2026-03-12T14:01:00Z" },
      { id: "t23", type: "viewed", description: "Viewed by Priya Sharma", timestamp: "2026-03-12T14:30:00Z", user: "Priya Sharma" },
      { id: "t24", type: "viewed", description: "Viewed by Alex Rivera", timestamp: "2026-03-12T15:00:00Z", user: "Alex Rivera" },
      { id: "t25", type: "reminder", description: "AI Reminder sent to Raj Patel", timestamp: "2026-03-15T10:00:00Z" },
      { id: "t26", type: "reminder", description: "AI Follow-up Reminder sent to Raj Patel (Firm Tone)", timestamp: "2026-03-17T10:00:00Z" },
    ],
  },
  {
    id: "CMP-106",
    title: "Garden Maintenance Delay",
    description: "The community garden has not been maintained for over a month. Plants are dying and pathways are overgrown.",
    category: "Maintenance",
    priority: "Low",
    status: "Resolved",
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-10T15:00:00Z",
    recipients: [
      { name: "Maria Lopez", seen: true, time: "10:20 AM" },
      { name: "John Doe", seen: true, time: "11:00 AM" },
    ],
    aiActions: [],
    timeline: [
      { id: "t27", type: "created", description: "Complaint created by Resident #22", timestamp: "2026-03-01T10:00:00Z" },
      { id: "t28", type: "email_sent", description: "Email sent to 2 committee members", timestamp: "2026-03-01T10:01:00Z" },
      { id: "t29", type: "viewed", description: "Viewed by Maria Lopez", timestamp: "2026-03-01T10:20:00Z", user: "Maria Lopez" },
      { id: "t30", type: "viewed", description: "Viewed by John Doe", timestamp: "2026-03-01T11:00:00Z", user: "John Doe" },
      { id: "t31", type: "resolved", description: "Garden maintenance completed by vendor", timestamp: "2026-03-10T15:00:00Z" },
    ],
  },
];

export const notifications: Notification[] = [
  { id: "n1", title: "Escalation Alert", message: "CMP-101 has been escalated due to 48h non-response", time: "9:00 AM", read: false, priority: "High", complaintId: "CMP-101" },
  { id: "n2", title: "New Complaint Filed", message: "Parking Violation at Spot 45 needs review", time: "7:01 AM", read: false, priority: "Low", complaintId: "CMP-104" },
  { id: "n3", title: "AI Reminder Sent", message: "Reminder sent to Raj Patel for CMP-102", time: "8:00 AM", read: true, priority: "Medium", complaintId: "CMP-102" },
  { id: "n4", title: "Complaint Resolved", message: "Garden Maintenance (CMP-106) marked as resolved", time: "Yesterday", read: true, priority: "Low", complaintId: "CMP-106" },
  { id: "n5", title: "Camera Issue Follow-up", message: "Second AI reminder sent for CMP-105", time: "10:00 AM", read: false, priority: "High", complaintId: "CMP-105" },
  { id: "n6", title: "Member Viewed Complaint", message: "John Doe viewed CMP-101", time: "10:32 AM", read: true, priority: "Medium", complaintId: "CMP-101" },
  { id: "n7", title: "Reassignment Notice", message: "CMP-103 reassigned to Maria Lopez", time: "Yesterday", read: true, priority: "Critical", complaintId: "CMP-103" },
];

export const adminLogs: AdminLog[] = [
  { id: "l1", action: "Email Sent", target: "CMP-101 — 4 recipients", user: "System", timestamp: "Mar 14, 09:31 AM", type: "email" },
  { id: "l2", action: "Viewed", target: "CMP-101", user: "Alex Rivera", timestamp: "Mar 14, 09:50 AM", type: "view" },
  { id: "l3", action: "Viewed", target: "CMP-101", user: "John Doe", timestamp: "Mar 14, 10:32 AM", type: "view" },
  { id: "l4", action: "AI Reminder Sent", target: "CMP-101 → Sara Khan", user: "AI System", timestamp: "Mar 16, 02:00 PM", type: "reminder" },
  { id: "l5", action: "Escalation Triggered", target: "CMP-101", user: "AI System", timestamp: "Mar 17, 09:00 AM", type: "escalation" },
  { id: "l6", action: "Email Sent", target: "CMP-102 — 3 recipients", user: "System", timestamp: "Mar 15, 11:01 AM", type: "email" },
  { id: "l7", action: "AI Reminder Sent", target: "CMP-102 → Raj Patel", user: "AI System", timestamp: "Mar 17, 08:00 AM", type: "reminder" },
  { id: "l8", action: "Auto-Escalated", target: "CMP-103", user: "AI System", timestamp: "Mar 13, 08:00 PM", type: "escalation" },
  { id: "l9", action: "Reassigned", target: "CMP-103 → Maria Lopez", user: "AI System", timestamp: "Mar 14, 09:00 AM", type: "reassignment" },
  { id: "l10", action: "Resolved", target: "CMP-103 — Elevator repaired", user: "Admin", timestamp: "Mar 16, 04:00 PM", type: "view" },
  { id: "l11", action: "Email Sent", target: "CMP-104 — 2 recipients", user: "System", timestamp: "Mar 17, 07:01 AM", type: "email" },
  { id: "l12", action: "AI Reminder Sent", target: "CMP-105 → Raj Patel", user: "AI System", timestamp: "Mar 15, 10:00 AM", type: "reminder" },
];

export const dashboardStats = {
  total: complaints.length,
  pending: complaints.filter(c => c.status === "New" || c.status === "In Review").length,
  viewed: notifications.filter(n => n.read).length,
  escalations: complaints.filter(c => c.status === "Escalated").length,
};
