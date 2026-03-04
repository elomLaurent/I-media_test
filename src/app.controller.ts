import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
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
        environment: 'development',
      },
    },
  })
  getHealth() {
    return this.appService.getHealth();
  }
}
