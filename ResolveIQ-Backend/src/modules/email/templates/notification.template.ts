export interface NotificationEmailContext {
  recipientName: string;
  complaintTitle: string;
  complaintId: string;
  trackingId: string;
  message: string;
  priority: string;
  appBaseUrl?: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#28a745',
  medium: '#ffc107',
  high: '#fd7e14',
  critical: '#dc3545',
};

export function buildNotificationEmailHtml(ctx: NotificationEmailContext): string {
  const color = PRIORITY_COLORS[ctx.priority] ?? '#6c757d';
  const trackingPixel = `${ctx.appBaseUrl}/api/v1/email/track/${ctx.trackingId}`;
  const redirectUrl = `${ctx.appBaseUrl}/api/v1/email/view/${ctx.trackingId}?complaintId=${ctx.complaintId}`;
  
  return `
<!DOCTYPE html>
<html>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 20px; color: #333;">
  <div style="border: 1px solid #e2e8f0; border-top: 4px solid ${color}; padding: 24px; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    <h2 style="margin: 0 0 16px; color: #1a202c; font-size: 20px;">ResolveIQ Notification</h2>
    <p style="font-size: 16px; line-height: 1.5;">Hello <strong>${ctx.recipientName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.5; color: #4a5568;">${ctx.message}</p>
    
    <div style="background:#f7fafc; border:1px solid #edf2f7; border-radius:6px; padding:16px; margin:24px 0;">
      <div style="margin-bottom: 8px;">
        <span style="color: #718096; font-size: 12px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em;">Complaint Title</span>
        <div style="font-weight: 600; color: #2d3748;">${ctx.complaintTitle}</div>
      </div>
      <div style="display: flex; gap: 20px;">
        <div style="margin-right: 24px;">
          <span style="color: #718096; font-size: 12px; text-transform: uppercase; font-weight: bold;">Priority</span>
          <div style="color: ${color}; font-weight: bold;">${ctx.priority.toUpperCase()}</div>
        </div>
        <div>
          <span style="color: #718096; font-size: 12px; text-transform: uppercase; font-weight: bold;">Reference ID</span>
          <div style="color: #2d3748; font-family: monospace;">${ctx.complaintId.split('-')[0]}...</div>
        </div>
      </div>
    </div>
    
    <div style="text-align: center; margin-top: 32px;">
      <a href="${redirectUrl}"
         style="background:${color}; color:#ffffff; padding:12px 24px; border-radius:6px; text-decoration:none; display:inline-block; font-weight: 600; font-size: 16px;">
        View Full Details
      </a>
    </div>
    
    <p style="margin-top: 32px; font-size: 12px; color: #a0aec0; text-align: center; border-top: 1px solid #edf2f7; pt: 16px;">
      This is an automated message from ResolveIQ Case Management System.
    </p>
  </div>
  <!-- Tracking Pixel (Opacity 0 ensures it's not hidden by display:none filters) -->
  <img src="${trackingPixel}" width="1" height="1" style="opacity: 0; position: absolute;" alt="" />
</body>
</html>`;
}
