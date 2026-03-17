import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EscalationService } from './escalation.service';
import { EscalationLog, EscalationStep, EscalationStatus } from './entities/escalation-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { EventsGateway } from '../gateway/events.gateway';

describe('EscalationService', () => {
  let service: EscalationService;

  const mockLogRepo = {
    create: jest.fn().mockReturnValue({}),
    save: jest.fn().mockResolvedValue({ id: 'log-1' }),
    find: jest.fn().mockResolvedValue([]),
  };

  const mockNotificationsService = {
    getUnacknowledgedNotifications: jest.fn().mockResolvedValue([]),
    getUnreadRecipients: jest.fn().mockResolvedValue([]),
    createNotification: jest.fn().mockResolvedValue({ id: 'n-2', recipients: [] }),
    markRecipientSent: jest.fn().mockResolvedValue(undefined),
    incrementReminderCount: jest.fn().mockResolvedValue(undefined),
  };

  const mockAiService = {
    determineTone: jest.fn().mockReturnValue('polite'),
    generateReminderEmail: jest.fn().mockResolvedValue({
      subject: 'Reminder', body: 'Please review', tone: 'polite',
    }),
  };

  const mockEmailService = {
    buildNotificationHtml: jest.fn().mockReturnValue('<html></html>'),
    sendEmail: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockUsersService = {
    getAvailableCommitteeMembers: jest.fn().mockResolvedValue([{ id: 'u-2', email: 'member@test.com', fullName: 'Bob' }]),
  };

  const mockGateway = {
    emitEscalationTriggered: jest.fn(),
    emitPushNotification: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        EscalationService,
        { provide: getRepositoryToken(EscalationLog), useValue: mockLogRepo },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: AiService, useValue: mockAiService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: UsersService, useValue: mockUsersService },
        { provide: EventsGateway, useValue: mockGateway },
      ],
    }).compile();
    service = module.get<EscalationService>(EscalationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log an escalation step', async () => {
    await service.logEscalation({
      complaintId: 'c-1',
      originalNotificationId: 'n-1',
      targetUserId: 'u-1',
      step: EscalationStep.REMINDER,
      metadata: { tone: 'polite' },
    });
    expect(mockLogRepo.save).toHaveBeenCalled();
  });

  it('should return escalation history for a complaint', async () => {
    const result = await service.getEscalationHistory('c-1');
    expect(Array.isArray(result)).toBe(true);
  });
});
