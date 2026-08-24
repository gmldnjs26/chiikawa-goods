import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { inList, inListOrNull } from '../../_common/enum-check';
import { Source } from '../../sources/entities/source.entity';

/** docs/db-schema.md §3. 스킵 2종은 docs/data-collection-design.md §6.1–6.2 */
export const RUN_STATUSES = [
  'running',
  'success',
  'failed',
  /** 앞선 실행이 아직 돌고 있어 종료. 자주 나오면 주기가 너무 짧다 */
  'skipped_locked',
  /** 창구 폴링인데 오늘 예정이 없어 외부 요청 없이 종료 */
  'skipped_idle',
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** `validation`이 따로 있다 — 소프트 404는 http_status 200이어도 실패다 (§7) */
export const FAILURE_KINDS = ['network', 'http', 'validation', 'parse', 'blocked'] as const;
export type FailureKind = (typeof FAILURE_KINDS)[number];

/** 수집 실행 기록 (docs/db-schema.md §3). 헬스 판정의 유일한 근거다 */
@Entity('collection_run')
@Check('CHK_collection_run_status', inList('status', RUN_STATUSES))
@Check('CHK_collection_run_failure_kind', inListOrNull('failure_kind', FAILURE_KINDS))
@Index(['sourceId', 'startedAt'])
export class CollectionRun {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'bigint' })
  sourceId!: string;

  @ManyToOne(() => Source, { nullable: false })
  @JoinColumn({ name: 'source_id' })
  source!: Source;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'text' })
  status!: RunStatus;

  @Column({ type: 'integer', default: 0 })
  mentionCount!: number;

  @Column({ type: 'integer', default: 0 })
  newCount!: number;

  /** 관련성 필터로 제외한 건수. 비율이 급변하면 태그 체계가 바뀐 것이다 (§4) */
  @Column({ type: 'integer', default: 0 })
  excludedCount!: number;

  @Column({ type: 'integer', nullable: true })
  httpStatus!: number | null;

  @Column({ type: 'text', nullable: true })
  failureKind!: FailureKind | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;
}
