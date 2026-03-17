import { Test } from '@nestjs/testing';
import { ComplaintNotifierService } from './complaint-notifier.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';
import { ComplaintPriority, ComplaintCategory } from './entities/complaint.entity';
import { NotificationType, NotificationChannel } from '../notifications/entities/notification.entity';

describe('ComplaintNotifierService', () => {
  let service: ComplaintNotifierService;

  const mockComplaint = {
    id: 'c-1',
    title: 'Broken AC',
    description: 'AC broken',
    priority: ComplaintPriority.HIGH,
    category: ComplaintCategory.FACILITIES,
    raisedById: 'user-1',
    raisedBy: { fullName: 'Alice', email: 'alice@test.com' },
  };

  const mockNotificationsService = {
    createNotification: jest.fn().mockResolvedValue({
      id: 'n-1',
      subject: 'Test subject',
      recipients: [{ id: 'nr-1', trackingId: 'track-1', recipientId: 'u-2' }],
    }),
    markRecipientSent: jest.fn().mockResolvedValue(undefined),
    markRecipientFailed: jest.fn().mockResolvedValue(undefined),
  };

  const mockEmailService = {
    buildNotificationHtml: jest.fn().mockReturnValue('<html></html>'),
    sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
  };

  const mockUsersService = {
    getCommitteeMembers: jest.fn().mockResolvedValue([
      { id: 'u-2', email: 'bob@test.com', fullName: 'Bob', role: 'committee_member' },
      { id: 'u-3', email: 'carol@test.com', fullName: 'Carol', role: 'committee_member' },
    ]),
    getManagers: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.APP_BASE_URL = 'http://localhost:3000';
    const module = await Test.createTestingModule({
      providers: [
        ComplaintNotifierService,
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: UsersService, useValue: mockUsersService },
      ],
    }).compile();
    service = module.get<ComplaintNotifierService>(ComplaintNotifierService);
  });

  it('should send initial notifications to all committee members', async () => {
    await service.notifyCommittee(mockComplaint as any);
    expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        complaintId: 'c-1',
        type: NotificationType.INITIAL,
        channel: NotificationChannel.EMAIL,
      }),
    );
    expect(mockEmailService.sendEmail).toHaveBeenCalled();
  });

  it('should mark recipient as sent on successful email', async () => {
    await service.notifyCommittee(mockComplaint as any);
    expect(mockNotificationsService.markRecipientSent).toHaveBeenCalled();
  });
});
