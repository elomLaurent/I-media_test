import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('API_PORT', 3000);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  
  const swaggerConfig = new DocumentBuilder()
    .setTitle('User Management API')
    .setDescription('RESTful API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Users', 'User management')
    .addTag('Health', 'Health check')


    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  app.enableCors();

  await app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`API Docs: http://localhost:${port}/api/docs`);
  });
}
bootstrap();
