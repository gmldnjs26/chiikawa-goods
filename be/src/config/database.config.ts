import { types as pgTypes } from 'pg';
import type { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategy';

/**
 * `date` 컬럼은 문자열(`YYYY-MM-DD`) 그대로 받는다.
 *
 * pg 드라이버 기본값은 `date`를 **서버 로컬 자정의 `Date`**로 바꾼다. 엔티티의 `@Column({ type: 'date' })`는
 * TypeORM이 다시 문자열로 되돌리지만, `@ViewColumn()`은 `type`을 갖지 않아 (`ViewColumnOptions`는
 * `name` · `transformer`뿐) `Date`가 그대로 새어 나온다 — `item_current_schedule.scheduled_on`이 그랬다.
 * 달력일은 이 프로젝트에서 전부 JST 문자열이다 (docs/db-schema.md §1). 드라이버 층에서 한 번에 막는다.
 * 전역 파서라 CLI · API 양쪽에 같이 걸린다.
 */
pgTypes.setTypeParser(pgTypes.builtins.DATE, (value: string) => value);

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
    migrations: [`${__dirname}/../migrations/*.{ts,js}`],
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
