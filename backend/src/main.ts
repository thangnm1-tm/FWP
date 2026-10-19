import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS — explicit allow-list only. Wildcard origins combined with
  // credentials are rejected by browsers and unsafe; never fall back to '*'.
  const configuredCorsOrigins = process.env.CORS_ORIGINS?.trim();
  const corsOrigins = (configuredCorsOrigins || 'http://localhost:3000,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!configuredCorsOrigins && process.env.NODE_ENV === 'production') {
    throw new Error(
      'CORS_ORIGINS must be set to an explicit comma-separated allow-list in production',
    );
  }

  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('FwP - Friend With PTIT API')
    .setDescription('Dating / Friend-matching API with ML Recommendation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.BACKEND_PORT || 3000;
  await app.listen(port);
  console.log(`🚀 FwP Backend running on http://localhost:${port}`);
  console.log(`📖 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
