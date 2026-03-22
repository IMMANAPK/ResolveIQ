import { Test } from '@nestjs/testing';
import { AiService } from './ai.service';
import { ConfigService } from '@nestjs/config';

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'GEMINI_API_KEY') return 'test-key';
              return null;
            }),
          },
        },
      ],
    }).compile();
    service = module.get<AiService>(AiService);
  });

  it('should determine tone as polite for first reminder on medium priority', () => {
    const tone = service.determineTone('medium', 0);
    expect(tone).toBe('polite');
  });

  it('should determine tone as urgent for second reminder on high priority', () => {
    const tone = service.determineTone('high', 1);
    expect(tone).toBe('urgent');
  });

  it('should determine tone as critical for critical priority', () => {
    const tone = service.determineTone('critical', 2);
    expect(tone).toBe('critical');
  });

  it('should build a valid prompt string', () => {
    const prompt = service.buildReminderPrompt({
      recipientName: 'Jane',
      complaintTitle: 'Broken AC',
      complaintDescription: 'The AC has been broken for 3 days.',
      priority: 'high',
      tone: 'urgent',
      reminderCount: 1,
      hoursElapsed: 4,
    });
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });
});
