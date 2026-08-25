import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });
  app.setGlobalPrefix('api');
  // Browser Origin never has a trailing slash; strip so env typos don't break CORS.
  const corsOrigin = (
    config.get<string>('CORS_ORIGIN', 'http://localhost:3000') ??
    'http://localhost:3000'
  ).replace(/\/+$/, '');
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('School 78 API')
    .setDescription(
      'Yerevan Basic School No. 78 portal API: auth, multilingual blog, categories, users, uploads',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste access token from POST /api/auth/login',
      },
      'JWT',
    )
    .addTag('auth')
    .addTag('posts')
    .addTag('categories')
    .addTag('users')
    .addTag('stats')
    .addTag('uploads')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = Number(config.get('PORT') ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://0.0.0.0:${port}/api`);
  console.log(`Swagger UI: http://0.0.0.0:${port}/api/docs`);
}
bootstrap();
