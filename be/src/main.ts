import 'reflect-metadata';

import { CommandFactory } from 'nest-commander';

import { AppModule } from './app.module';

/**
 * Cloud Run Job의 진입점 (docs/tech-stack.md §2.3).
 * HTTP 서버를 띄우지 않는다. 커맨드를 실행하고 종료한다.
 */
async function bootstrap(): Promise<void> {
  await CommandFactory.run(AppModule, ['warn', 'error']);
}

void bootstrap();
