import { MigrationInterface, QueryRunner } from 'typeorm';

import { inList } from '@/modules/_common/enum-check';
import { RUN_STATUSES } from '@/modules/collection-runs/entities/collection-run.entity';

/**
 * `skipped_interval` 추가 (docs/data-collection-design.md §6.1.1).
 *
 * 「주기가 안 지나서 안 돌았다」와 「오늘 예정이 없어 안 돌았다」는 다른 신호다.
 * 앞엣것이 자주 나오면 **스케줄러가 과발화**한다는 뜻이고, 뒤엣것은 정상이다.
 * `collection_run`이 헬스 판정의 유일한 근거라 합치면 그 판정이 흐려진다.
 *
 * **generator가 CHECK 식 변경을 잡지 못한다.** 손으로 쓴다 (be/CLAUDE.md §3).
 */
export class AddSkippedIntervalStatus1787660000000 implements MigrationInterface {
  name = 'AddSkippedIntervalStatus1787660000000';

  private readonly previous = RUN_STATUSES.filter((status) => status !== 'skipped_interval');

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collection_run" DROP CONSTRAINT "CHK_collection_run_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_run" ADD CONSTRAINT "CHK_collection_run_status" CHECK (${inList('status', RUN_STATUSES)})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 되돌리기 전에 새 값이 남아 있으면 CHECK가 거부한다. 그게 맞다 —
    // 조용히 지우지 않는다 (하드 삭제 금지)
    await queryRunner.query(
      `ALTER TABLE "collection_run" DROP CONSTRAINT "CHK_collection_run_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collection_run" ADD CONSTRAINT "CHK_collection_run_status" CHECK (${inList('status', this.previous)})`,
    );
  }
}
