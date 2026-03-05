// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis'; 
import Redis from 'ioredis';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('health')
export class HealthController {

    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
        @InjectRedis()
        private readonly redisClient: Redis,
    ) { }

    @Get('health')
    @ApiOperation({ summary: 'Health check endpoint' })
    @ApiResponse({
        status: 200,
        description: 'Service is healthy',
        schema: {
            example: {
                status: 'ok',
                version: '1.0.0',
                timestamp: '2025-12-02T10:30:00.000Z',
                dbStatus: 'connected',
            },
        },
    })
    async check() {
        const dbStatus = await this.checkDatabase();
        const redisStatus = await this.checkRedis();

        const allHealthy = dbStatus === 'connected' && redisStatus === 'connected';

        return {
            status: allHealthy ? 'ok' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                db_status: dbStatus,
            },
        };
    }

    private async checkDatabase(): Promise<'connected' | 'disconnected'> {
        try {
            await this.dataSource.query('SELECT 1');
            return 'connected';
        } catch {
            return 'disconnected';
        }
    }

    private async checkRedis(): Promise<'connected' | 'disconnected'> {
        try {
            await this.redisClient.ping();
            return 'connected';
        } catch {
            return 'disconnected';
        }
    }
}