import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DataSource } from 'typeorm';

describe('HealthController', () => {
  let controller: HealthController;

  const mockDataSource = {
    query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  };

  const mockRedisClient = {
    ping: jest.fn().mockResolvedValue('PONG'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          // Token utilisé en interne par @nestjs-modules/ioredis
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return ok when DB and Redis are connected', async () => {
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.services.db_status).toBe('connected');
  });

  it('should return degraded when DB is down', async () => {
    mockDataSource.query.mockRejectedValueOnce(new Error('DB down'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.db_status).toBe('disconnected');
  });

  it('should return degraded when Redis is down', async () => {
    mockRedisClient.ping.mockRejectedValueOnce(new Error('Redis down'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.db_status).toBe('connected');
  });
});