import { Test } from '@nestjs/testing';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    process.env.APP_BASE_URL = 'http://localhost:3000';
    process.env.EMAIL_FROM = 'test@test.com';
    const module = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();
    service = module.get<EmailService>(EmailService);
  });

  it('should build tracking pixel URL from trackingId', () => {
    const url = service.buildTrackingPixelUrl('tracking-uuid-123');
    expect(url).toBe('http://localhost:3000/api/v1/email/track/tracking-uuid-123');
  });

  it('should build notification email HTML with tracking pixel', () => {
    const html = service.buildNotificationHtml({
      recipientName: 'John',
      complaintTitle: 'Broken AC',
      complaintId: 'c-1',
      trackingId: 'track-1',
      message: 'A complaint needs your attention.',
      priority: 'high',
    });
    expect(html).toContain('track-1');
    expect(html).toContain('Broken AC');
  });
});
