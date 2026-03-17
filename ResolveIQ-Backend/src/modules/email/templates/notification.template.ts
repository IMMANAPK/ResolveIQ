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
  const trackingPixel = `${ctx.appBaseUrl ?? ''}/api/v1/email/track/${ctx.trackingId}`;
  return `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
  <div style="border-left: 5px solid ${color}; padding: 16px; background: #f9f9f9; border-radius: 4px;">
    <h2 style="margin: 0 0 8px; color: #333;">ResolveIQ — Action Required</h2>
    <p style="font-size: 14px; color: #666;">Hello ${ctx.recipientName},</p>
    <p style="font-size: 15px;">${ctx.message}</p>
    <div style="background:#fff; border:1px solid #ddd; border-radius:4px; padding:12px; margin:16px 0;">
      <strong>Complaint:</strong> ${ctx.complaintTitle}<br/>
      <strong>Priority:</strong> <span style="color:${color}; font-weight:bold;">${ctx.priority.toUpperCase()}</span><br/>
      <strong>ID:</strong> ${ctx.complaintId}
    </div>
    <a href="${ctx.appBaseUrl}/complaints/${ctx.complaintId}"
       style="background:${color};color:#fff;padding:10px 20px;border-radius:4px;text-decoration:none;display:inline-block;">
      View Complaint
    </a>
  </div>
  <img src="${trackingPixel}" width="1" height="1" style="display:none;" alt="" />
</body>
</html>`;
}
