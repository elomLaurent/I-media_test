// src/modules/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/entities/user.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;

  const mockUserRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUser: Partial<User> = {
    id: 'uuid-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed_password',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── create() ──────────────────────────────────────────────────

  describe('create()', () => {
    const createDto = {
      email: 'test@example.com',
      name: 'Test User',
      password: 'plainpassword123',
    };

    it('should create and return a user without passwordHash', async () => {
      // Aucun utilisateur existant
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ ...mockUser });
      mockUserRepository.save.mockResolvedValue({ ...mockUser });

      const result = await service.create(createDto);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('id');
      expect(result.email).toBe('test@example.com');
      expect(result.name).toBe('Test User');
    });

    it('should throw BadRequestException if email already exists', async () => {
      // Un utilisateur avec cet email existe déjà
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(createDto)).rejects.toThrow(
        'User with this email already exists',
      );
    });

    it('should hash the password before saving', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ ...mockUser });
      mockUserRepository.save.mockResolvedValue({ ...mockUser });

      await service.create(createDto);

      // Le save doit avoir été appelé avec un passwordHash, pas un password en clair
      const savedArg = mockUserRepository.save.mock.calls[0][0];
      expect(savedArg.passwordHash).toBeDefined();
      expect(savedArg.password).toBeUndefined();
    });

    it('should call repository.save once', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ ...mockUser });
      mockUserRepository.save.mockResolvedValue({ ...mockUser });

      await service.create(createDto);

      expect(mockUserRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  // ─── findById() ────────────────────────────────────────────────

  describe('findById()', () => {
    it('should return a user without passwordHash', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('uuid-123');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('uuid-999')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findById('uuid-999')).rejects.toThrow(
        'User with ID uuid-999 not found',
      );
    });

    it('should call findOne with correct id', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await service.findById('uuid-123');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'uuid-123' },
      });
    });
  });

  // ─── findAll() ─────────────────────────────────────────────────

  describe('findAll()', () => {
    it('should return an array of users without passwordHash', async () => {
      mockUserRepository.find.mockResolvedValue([mockUser, mockUser]);

      const result = await service.findAll();

      expect(result).toHaveLength(2);
      result.forEach((user) => {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).not.toHaveProperty('id');
      });
    });

    it('should return empty array when no users exist', async () => {
      mockUserRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });

    it('should call repository.find once', async () => {
      mockUserRepository.find.mockResolvedValue([]);

      await service.findAll();

      expect(mockUserRepository.find).toHaveBeenCalledTimes(1);
    });
  });
});