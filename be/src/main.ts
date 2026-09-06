import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { CommandFactory } from 'nest-commander';

import { AppModule } from './app.module';

/**
 * 진입점 하나. 첫 인자가 모드를 정한다 (be/CLAUDE.md §1).
 *
 * - `api`      → HTTP 서버. Cloud Run Service. 상주
 * - 그 외      → nest-commander 커맨드. Cloud Run Job. 돌고 exit 0
 *
 * 같은 이미지를 첫 인자만 바꿔 배포한다 (docs/tech-stack.md §2.8).
 */
async function bootstrap(): Promise<void> {
  if (process.argv[2] === 'api') {
    await serve();
    return;
  }
  await CommandFactory.run(AppModule, ['warn', 'error']);
}

async function serve(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.enableShutdownHooks();

  // Cloud Run은 PORT를 준다. 로컬은 API_PORT (.env.example)
  const raw = process.env.PORT ?? process.env.API_PORT ?? '3001';
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT/API_PORT가 포트 번호가 아니다: ${raw}`);
  }
  await app.listen(port);
  new Logger('api').log(`읽기 API가 :${port}에서 듣는다`);
}

void bootstrap();
