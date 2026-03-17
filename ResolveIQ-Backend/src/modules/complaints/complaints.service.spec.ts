import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory } from './entities/complaint.entity';

const mockComplaint: Partial<Complaint> = {
  id: 'c-uuid-1',
  title: 'Test complaint',
  status: ComplaintStatus.OPEN,
  priority: ComplaintPriority.HIGH,
  category: ComplaintCategory.HR,
  raisedById: 'user-1',
};

const mockRepo = {
  create: jest.fn().mockReturnValue(mockComplaint),
  save: jest.fn().mockResolvedValue(mockComplaint),
  findOne: jest.fn().mockResolvedValue(mockComplaint),
  find: jest.fn().mockResolvedValue([mockComplaint]),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};

describe('ComplaintsService', () => {
  let service: ComplaintsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ComplaintsService,
        { provide: getRepositoryToken(Complaint), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<ComplaintsService>(ComplaintsService);
  });

  it('should create a complaint', async () => {
    const result = await service.create({
      title: 'Test',
      description: 'Desc',
      category: ComplaintCategory.HR,
      priority: ComplaintPriority.HIGH,
      raisedById: 'user-1',
    });
    expect(result.title).toBe('Test complaint');
  });

  it('should find a complaint by id', async () => {
    const result = await service.findById('c-uuid-1');
    expect(result?.id).toBe('c-uuid-1');
  });

  it('should throw NotFoundException for findOrFail with bad id', async () => {
    mockRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.findOrFail('nonexistent')).rejects.toThrow(NotFoundException);
  });
});
