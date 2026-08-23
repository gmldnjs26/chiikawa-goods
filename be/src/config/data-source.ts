import 'reflect-metadata';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { buildDataSourceOptions } from './database.config';

// TypeORM 1.x는 .env를 자동 로드하지 않는다 (TYPEORM_* 환경변수도 제거됨).
// CLI(migration:*)는 Nest 컨텍스트 밖에서 돌기 때문에 여기서 직접 읽는다.
loadEnv();

/** `npm run migration:*`이 참조하는 DataSource. 앱 런타임은 TypeOrmModule을 쓴다. */
export default new DataSource(buildDataSourceOptions());
