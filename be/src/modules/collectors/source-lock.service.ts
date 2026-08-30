import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';

/** 같은 소스의 락임을 구분하는 네임스페이스. 다른 용도의 advisory lock과 섞이지 않게 한다 */
const LOCK_NAMESPACE = 0x1c1a;

/**
 * 소스 단위 advisory lock (docs/data-collection-design.md §6.2).
 *
 * Cloud Run Job execution은 서로를 모른다 — 1분 간격인데 수집이 70초 걸리면
 * 같은 소스에 요청이 2배 나간다. 스케줄러를 바꿔도 이 문제는 남는다.
 *
 * **락은 세션에 걸린다.** 풀에서 아무 커넥션이나 쓰면 해제가 다른 커넥션으로 가서
 * 락이 남는다. 전용 `QueryRunner`를 잡고 그 위에서 잠그고 푼다.
 */
@Injectable()
export class SourceLockService {
  private readonly logger = new Logger(SourceLockService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** 못 잡으면 `null`. **재시도하지 않는다** — 그 실행은 즉시 끝낸다 */
  async acquire(sourceId: string): Promise<QueryRunner | null> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();

    const [{ locked }] = (await runner.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [
      LOCK_NAMESPACE,
      Number(sourceId),
    ])) as { locked: boolean }[];

    if (!locked) {
      await runner.release();
      this.logger.warn(`락 획득 실패 — source_id=${sourceId}. 앞선 실행이 돌고 있다`);
      return null;
    }

    return runner;
  }

  async release(runner: QueryRunner, sourceId: string): Promise<void> {
    try {
      await runner.query('SELECT pg_advisory_unlock($1, $2)', [LOCK_NAMESPACE, Number(sourceId)]);
    } finally {
      await runner.release();
    }
  }
}
