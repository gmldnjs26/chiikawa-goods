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
import { Item, ITEM_STATUSES, ItemStatus } from '@/modules/items/entities/item.entity';
import { Mention } from '@/modules/mentions/entities/mention.entity';

/**
 * 상태 전이 이력 (docs/db-schema.md §8). **append-only.**
 *
 * `RESTOCK`은 상태가 아니라 `ENDED → ON_SALE` 전이다 — 그리고 반복된다.
 * 그래서 `(item_id, status)`에 unique를 **걸지 않는다.**
 * `ENDED → ON_SALE → ENDED → ON_SALE`이 정상 이력이다.
 *
 * 대신 재실행 멱등을 위한 부분 unique 2개를 건다 — 관측 1건 = 전이 1행, 백필 날짜 1개 = 1행.
 */
@Entity('status_history')
@Check('CHK_status_history_status', inList('status', ITEM_STATUSES))
@Index(['itemId', 'observedAt'])
// 실시간 관측: 같은 mention이 같은 item에 두 번 전이를 만들지 않는다
@Index('UQ_status_history_observation', ['itemId', 'mentionId'], {
  unique: true,
  where: '"is_backfilled" = false',
})
// 백필: 태그 날짜 하나가 행 하나다. 같은 태그를 가진 mention이 N개여도 N행이 되지 않는다
@Index('UQ_status_history_backfill', ['itemId', 'observedAt'], {
  unique: true,
  where: '"is_backfilled" = true',
})
export class StatusHistory {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'bigint' })
  itemId!: string;

  @ManyToOne(() => Item, { nullable: false })
  @JoinColumn({ name: 'item_id' })
  item!: Item;

  @Column({ type: 'text' })
  status!: ItemStatus;

  /**
   * 전이를 관측한 시각. 그 mention의 `observed_at`이다 — 정규화를 돌린 시각이 아니다.
   * 백필 행은 태그 날짜 00:00 JST다 (docs/source-mapping.md §3.4)
   */
  @Column({ type: 'timestamptz', default: () => 'now()' })
  observedAt!: Date;

  /** 판정 근거 */
  @Column({ type: 'bigint', nullable: true })
  mentionId!: string | null;

  @ManyToOne(() => Mention, { nullable: true })
  @JoinColumn({ name: 'mention_id' })
  mention!: Mention | null;

  /**
   * 태그에서 소급 생성한 행. **개시 시각 통계에서 제외한다** —
   * 날짜만 알고 시각은 모르므로 섞으면 "재입고는 0시에 일어난다"는 틀린 실측치가 나온다
   */
  @Column({ type: 'boolean', default: false })
  isBackfilled!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
