import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

export const getTypeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DB_HOST', 'localhost'),
  port: configService.get('DB_PORT', 5432),
  username: configService.get(' DB_USER', 'postgres'),
  password: configService.get('DB_PASSWORD', 'Nn`*Xs[vU?U;A8Af'),
  database: configService.get('DB_DATABASE', 'ton_tine'),
  entities: [path.join(__dirname, '../entities/**/*.entity.ts')],
  migrations: [path.join(__dirname, '../database/migrations/**/*.ts')],
  synchronize: false,
  logging: configService.get('LOG_LEVEL') === 'debug',
  migrationsRun: false,
  ssl:
    configService.get('NODE_ENV') === 'production'
      ? { rejectUnauthorized: false }
      : false,
  retryAttempts: 1,
  retryDelay: 1000,
  connectTimeoutMS: 3000,
});
