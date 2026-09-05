import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { inList } from '@/modules/_common/enum-check';
import { Item } from '@/modules/items/entities/item.entity';
import { Mention } from '@/modules/mentions/entities/mention.entity';

export const SCHEDULE_KINDS = ['preorder', 'release', 'restock'] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

/**
 * 예정 (docs/db-schema.md §9). **append-only + `superseded_at`.**
 *
 * 「품절이지만 재입고가 예고된 것」을 표현하는 층이다. 상태는 `ENDED` 그대로다 —
 * `RESTOCK_SCHEDULED` 같은 상태를 만들면 `UPCOMING`과 의미가 겹치고 재입고 반복에서 무너진다.
 *
 * 공지는 갱신된다 (`9月下旬` → `9/15`). 덮어쓰면 "언제 무엇이 공지됐는지"가 사라진다.
 * 새 행을 넣고 이전 행에 `superseded_at`을 찍는다.
 */
@Entity('scheduled_event')
@Check('CHK_scheduled_event_kind', inList('kind', SCHEDULE_KINDS))
// 날짜 · 원문 · 미정 중 하나는 있어야 한다. 셋 다 비면 「예정」이 아니다
@Check(
  'CHK_scheduled_event_has_content',
  `"scheduled_on" IS NOT NULL OR "scheduled_text" IS NOT NULL OR "undecided"`,
)
@Index(['itemId', 'kind', 'observedAt'])
// 캘린더는 날짜가 확정된 유효 예정만 놓는다
@Index(['scheduledOn'], { where: '"superseded_at" IS NULL AND "scheduled_on" IS NOT NULL' })
export class ScheduledEvent {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'bigint' })
  itemId!: string;

  @ManyToOne(() => Item, { nullable: false })
  @JoinColumn({ name: 'item_id' })
  item!: Item;

  @Column({ type: 'text' })
  kind!: ScheduleKind;

  /** JST 달력일. 날짜가 확정된 경우만 */
  @Column({ type: 'date', nullable: true })
  scheduledOn!: string | null;

  /** `9月下旬` 원문 그대로. **날짜로 정규화하지 않는다** — 없는 정보를 만들게 된다 */
  @Column({ type: 'text', nullable: true })
  scheduledText!: string | null;

  /** `再入荷未定`이 명시된 경우 */
  @Column({ type: 'boolean', default: false })
  undecided!: boolean;

  /** 이 예정을 관측한 시각. 그 mention의 `observed_at`이다 */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  observedAt!: Date;

  @Column({ type: 'bigint', nullable: true })
  mentionId!: string | null;

  @ManyToOne(() => Mention, { nullable: true })
  @JoinColumn({ name: 'mention_id' })
  mention!: Mention | null;

  /** 새 공지로 대체됐거나 예정이 사라진 시각. NULL이 유효 행이다 — 유일한 권위다 (§12.1) */
  @Column({ type: 'timestamptz', nullable: true })
  supersededAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
