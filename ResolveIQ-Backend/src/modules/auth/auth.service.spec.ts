import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  const mockUsersService = {
    findByEmail: jest.fn(),
    createUser: jest.fn(),
  };
  const mockJwtService = { sign: jest.fn().mockReturnValue('mock.jwt.token') };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('should return null for invalid credentials (user not found)', async () => {
    mockUsersService.findByEmail.mockResolvedValueOnce(null);
    const result = await service.validateUser('bad@email.com', 'pass');
    expect(result).toBeNull();
  });

  it('should return null for wrong password', async () => {
    const hash = await bcrypt.hash('correctpass', 10);
    mockUsersService.findByEmail.mockResolvedValueOnce({
      id: '1', email: 'a@b.com', passwordHash: hash, role: UserRole.COMPLAINANT,
    });
    const result = await service.validateUser('a@b.com', 'wrongpass');
    expect(result).toBeNull();
  });

  it('should return access token on successful login', async () => {
    const hash = await bcrypt.hash('password', 10);
    mockUsersService.findByEmail.mockResolvedValueOnce({
      id: '1', email: 'a@b.com', passwordHash: hash, role: UserRole.COMPLAINANT,
    });
    const result = await service.login('a@b.com', 'password');
    expect(result).toHaveProperty('accessToken');
    expect(result.accessToken).toBe('mock.jwt.token');
  });

  it('should throw UnauthorizedException for bad login credentials', async () => {
    mockUsersService.findByEmail.mockResolvedValueOnce(null);
    await expect(service.login('bad@email.com', 'pass')).rejects.toThrow(UnauthorizedException);
  });
});
