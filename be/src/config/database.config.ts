import type { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategy';

/** TypeORM 1.x는 드라이버별 옵션 타입을 deep import로 노출하지 않는다. 유니온에서 좁혀 쓴다. */
export type PostgresDataSourceOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/**
 * 접속 방식을 환경변수로 추상화한다 (docs/tech-stack.md §2.6 요건 1).
 *
 * Cloud SQL은 `/cloudsql` Unix 소켓 마운트, 로컬·외부 Postgres는 TCP + TLS다.
 * 접속 문자열 교체만으로는 안 되므로 처음부터 양쪽을 받는다.
 * `DB_SOCKET_PATH`가 있으면 소켓, 없으면 TCP.
 */
export function buildDataSourceOptions(
  env: NodeJS.ProcessEnv = process.env,
): PostgresDataSourceOptions {
  const socketPath = env.DB_SOCKET_PATH;

  const connection = socketPath
    ? { host: socketPath, ssl: false as const }
    : {
        host: required(env, 'DB_HOST'),
        port: Number(env.DB_PORT ?? 5432),
        ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
      };

  return {
    type: 'postgres',
    ...connection,
    username: required(env, 'DB_USER'),
    password: required(env, 'DB_PASSWORD'),
    database: required(env, 'DB_NAME'),

    // migration-driven. entity를 고쳐서 스키마를 반영하지 않는다 (docs/tech-stack.md §2.4)
    synchronize: false,
    migrationsRun: false,

    entities: [`${__dirname}/../**/*.entity.{ts,js}`],
    migrations: [`${__dirname}/../database/migrations/*.{ts,js}`],
    migrationsTableName: 'migration',

    namingStrategy: new SnakeNamingStrategy(),
    logging: env.DB_LOGGING === 'true' ? 'all' : ['error', 'warn', 'migration'],
  };
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`환경변수 ${key}가 없다. be/.env.example 참고`);
  }
  return value;
}
