import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { inList } from '../../_common/enum-check';
import { CollectionRun } from '../../collection-runs/entities/collection-run.entity';
import { Source } from '../../sources/entities/source.entity';

/** docs/db-schema.md §4. 판정 규칙은 docs/source-mapping.md §7 */
export const RELEVANCES = ['included', 'mixed', 'excluded'] as const;
export type Relevance = (typeof RELEVANCES)[number];

/**
 * 원문 관측 (docs/db-schema.md §4). **불변이다** — 정규화 결과가 틀려도 원문은 남는다.
 *
 * UNIQUE에 `payload_hash`가 들어간다: `(source_id, external_id)`만으로 잡으면
 * 내용이 바뀌어도 새 행이 안 생긴다. 해시를 포함하면 변경 이력이 쌓이고,
 * 그게 파서 회귀 검증의 근거다.
 *
 * 행은 영구, 본문만 90일. `raw_payload`를 NULL로 만들고 `payload_purged_at`을 찍는다.
 */
@Entity('mention')
@Check('CHK_mention_relevance', inList('relevance', RELEVANCES))
@Unique(['sourceId', 'externalId', 'payloadHash'])
@Index(['sourceId', 'observedAt'])
// 정리 배치용: 90일 경과 + 본문 잔존. `payload_purged_at`에 걸면
// 조건이 참일 때 항상 NULL인 컬럼을 인덱싱하게 된다
@Index(['observedAt'], { where: '"raw_payload" IS NOT NULL' })
export class Mention {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'bigint' })
  sourceId!: string;

  @ManyToOne(() => Source, { nullable: false })
  @JoinColumn({ name: 'source_id' })
  source!: Source;

  @Column({ type: 'bigint', nullable: true })
  collectionRunId!: string | null;

  @ManyToOne(() => CollectionRun, { nullable: true })
  @JoinColumn({ name: 'collection_run_id' })
  collectionRun!: CollectionRun | null;

  /** 소스 고유 ID. dedupe 키. 같은 입력이면 같은 값이어야 한다 */
  @Column({ type: 'text' })
  externalId!: string;

  @Column({ type: 'text' })
  url!: string;

  @Column({ type: 'text' })
  rawTitle!: string;

  /** 90일 후 NULL 처리 (본문만 삭제) */
  @Column({ type: 'jsonb', nullable: true })
  rawPayload!: Record<string, unknown> | null;

  /** 내용 변경 판정 */
  @Column({ type: 'text' })
  payloadHash!: string;

  @Column({ type: 'timestamptz', nullable: true })
  payloadPurgedAt!: Date | null;

  /** `excluded`도 행은 남긴다 — 필터 규칙이 틀렸을 때 재처리로 복구한다 */
  @Column({ type: 'text', default: 'included' })
  relevance!: Relevance;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  observedAt!: Date;
}
