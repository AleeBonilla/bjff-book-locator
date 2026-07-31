import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module.js';
import { ErrorEnvelopeFilter } from './common/error-envelope.filter.js';
import { logger } from './common/logger.js';
import { loadConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: true });

  app.use(cookieParser());

  // FR-045: toda entrada se valida en el servidor, con independencia de la interfaz.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.useGlobalFilters(new ErrorEnvelopeFilter());

  app.enableCors({ origin: config.webOrigin, credentials: true });

  await app.listen(config.port);
  logger.info('api_started', { port: config.port });
}

void bootstrap();
