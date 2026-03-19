import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User, UserRole } from './entities/user.entity';

const mockUser: Partial<User> = {
  id: 'uuid-1',
  email: 'test@test.com',
  fullName: 'Test User',
  roles: [UserRole.COMPLAINANT],
  isActive: true,
  isAvailable: true,
};

const mockRepo = {
  findOne: jest.fn().mockResolvedValue(mockUser),
  find: jest.fn().mockResolvedValue([mockUser]),
  save: jest.fn().mockResolvedValue(mockUser),
  create: jest.fn().mockReturnValue(mockUser),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  it('should find user by email', async () => {
    const user = await service.findByEmail('test@test.com');
    expect(user?.email).toBe('test@test.com');
  });

  it('should return available committee members', async () => {
    const members = await service.getAvailableCommitteeMembers();
    expect(Array.isArray(members)).toBe(true);
  });
});
