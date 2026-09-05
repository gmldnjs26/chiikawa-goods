import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { inList } from '@/modules/_common/enum-check';
import { Item } from '@/modules/items/entities/item.entity';
import { Mention } from '@/modules/mentions/entities/mention.entity';

export const OVERRIDE_ACTIONS = ['merge', 'unmerge', 'ignore_mention'] as const;
export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number];

/**
 * 수동 교정 (docs/db-schema.md §11, docs/data-collection-design.md §9.3).
 *
 * 자동 병합만 두면 **틀린 병합을 고칠 방법이 없다.** 그래서 테이블을 처음부터 만든다.
 * `unmerge`는 자동 병합보다 항상 우선한다 — 다음 수집이 다시 붙이면 안 된다.
 *
 * 쓰는 코드는 아직 없다. 소스 간 병합(2단계 dedupe)이 생길 때 Deduper가 병합 전에 이 테이블을 본다.
 */
@Entity('merge_override')
@Check('CHK_merge_override_action', inList('action', OVERRIDE_ACTIONS))
export class MergeOverride {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'text' })
  action!: OverrideAction;

  @Column({ type: 'bigint', nullable: true })
  itemId!: string | null;

  @ManyToOne(() => Item, { nullable: true })
  @JoinColumn({ name: 'item_id' })
  item!: Item | null;

  @Column({ type: 'bigint', nullable: true })
  otherItemId!: string | null;

  @ManyToOne(() => Item, { nullable: true })
  @JoinColumn({ name: 'other_item_id' })
  otherItem!: Item | null;

  @Column({ type: 'bigint', nullable: true })
  mentionId!: string | null;

  @ManyToOne(() => Mention, { nullable: true })
  @JoinColumn({ name: 'mention_id' })
  mention!: Mention | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
