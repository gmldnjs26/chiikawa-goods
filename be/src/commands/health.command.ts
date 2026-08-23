import { Command, CommandRunner } from 'nest-commander';
import { DataSource } from 'typeorm';

/**
 * 부팅 확인용. DB에 붙고 상태를 찍고 끝난다.
 * 외부 사이트로 요청을 보내지 않는다.
 */
@Command({ name: 'health', description: 'DB 접속과 마이그레이션 상태를 확인한다' })
export class HealthCommand extends CommandRunner {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async run(): Promise<void> {
    const [{ version }] = await this.dataSource.query<{ version: string }[]>('SELECT version()');
    console.log(`db       : ${version}`);
    console.log(`database : ${describeTarget(this.dataSource)}`);
    console.log(`migration: ${await describeMigrations(this.dataSource)}`);
  }
}

/**
 * migration 파일이 0개이고 `migration` 테이블도 없는 상태가 정상이다 (스키마 착수 전).
 * 그 상태에서 던지면 부팅 확인이 불가능해지므로 여기서 흡수한다.
 */
async function describeMigrations(dataSource: DataSource): Promise<string> {
  if (dataSource.migrations.length === 0) {
    return 'migration 파일 없음 (스키마 미착수)';
  }
  try {
    return (await dataSource.showMigrations()) ? '미적용 있음' : '최신';
  } catch (error) {
    return `판정 불가 — ${error instanceof Error ? error.message : String(error)}`;
  }
}

function describeTarget(dataSource: DataSource): string {
  const { database, host } = dataSource.options as { database?: unknown; host?: unknown };
  const name = typeof database === 'string' ? database : '(불명)';
  return typeof host === 'string' ? `${name} @ ${host}` : name;
}
