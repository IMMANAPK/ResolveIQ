import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationType, NotificationChannel } from './entities/notification.entity';
import { NotificationRecipient, DeliveryStatus } from './entities/notification-recipient.entity';

const mockRecipient = {
  id: 'nr-1',
  notificationId: 'n-1',
  recipientId: 'u-1',
  trackingId: 'track-1',
  isRead: false,
  readAt: null,
  deliveryStatus: DeliveryStatus.SENT,
  reminderCount: 0,
};

const mockNotification = {
  id: 'n-1',
  complaintId: 'c-1',
  recipients: [mockRecipient],
  allRead: false,
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  const notifRepo = {
    create: jest.fn().mockReturnValue(mockNotification),
    save: jest.fn().mockResolvedValue(mockNotification),
    findOne: jest.fn().mockResolvedValue(mockNotification),
    find: jest.fn().mockResolvedValue([mockNotification]),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockNotification]),
    }),
  };

  const recipientRepo = {
    create: jest.fn().mockReturnValue(mockRecipient),
    save: jest.fn().mockResolvedValue({ ...mockRecipient, isRead: true, readAt: new Date() }),
    findOne: jest.fn().mockResolvedValue({ ...mockRecipient }),
    find: jest.fn().mockResolvedValue([mockRecipient]),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(NotificationRecipient), useValue: recipientRepo },
      ],
    }).compile();
    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should get notification status summary', async () => {
    const status = await service.getNotificationStatus('n-1');
    expect(status).toHaveProperty('totalRecipients');
    expect(status).toHaveProperty('readCount');
    expect(status).toHaveProperty('pendingCount');
  });

  it('should mark recipient as read by trackingId', async () => {
    const result = await service.markRecipientAsRead('track-1');
    expect(result).toBeTruthy();
  });

  it('should return unread recipients', async () => {
    const result = await service.getUnreadRecipients('n-1');
    expect(Array.isArray(result)).toBe(true);
  });
});
