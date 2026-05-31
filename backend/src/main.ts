import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

const DEFAULT_BACKEND_PORT = 3001;
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;

  const configuredOrigin = process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  if (origin === configuredOrigin) return true;

  try {
    const url = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Статика для стримов (записи/камеры и т.п.)
  app.useStaticAssets(join(process.cwd(), 'streams'), {
    prefix: '/streams',
  });

  // Глобальная валидация DTO
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // CORS для фронта (Next на 3000 по умолчанию)
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
  });

  // Все ручки будут начинаться с /api
  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT) || DEFAULT_BACKEND_PORT;
  await app.listen(port);
  console.log(`Backend: http://localhost:${port}`);
}

bootstrap();
