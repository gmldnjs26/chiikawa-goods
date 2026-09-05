import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { inList } from '@/modules/_common/enum-check';
import { Item } from '@/modules/items/entities/item.entity';
import { Mention } from '@/modules/mentions/entities/mention.entity';

/** `primary`가 공식 링크의 출처다 */
export const LINK_ROLES = ['primary', 'evidence'] as const;
export type LinkRole = (typeof LINK_ROLES)[number];

export const LINKED_BY = ['auto', 'manual'] as const;
export type LinkedBy = (typeof LINKED_BY)[number];

/**
 * 출처 연결 N:N (docs/db-schema.md §7).
 * 하나의 굿즈가 여러 소스에서 온다. 이 테이블이 출처 표기의 데이터 근거다 (docs/plan.md §6.8).
 */
@Entity('item_mention')
@Check('CHK_item_mention_role', inList('role', LINK_ROLES))
@Check('CHK_item_mention_linked_by', inList('linked_by', LINKED_BY))
@Index(['mentionId'])
export class ItemMention {
  @PrimaryColumn({ type: 'bigint' })
  itemId!: string;

  @PrimaryColumn({ type: 'bigint' })
  mentionId!: string;

  @ManyToOne(() => Item, { nullable: false })
  @JoinColumn({ name: 'item_id' })
  item!: Item;

  @ManyToOne(() => Mention, { nullable: false })
  @JoinColumn({ name: 'mention_id' })
  mention!: Mention;

  @Column({ type: 'text', default: 'evidence' })
  role!: LinkRole;

  @Column({ type: 'text', default: 'auto' })
  linkedBy!: LinkedBy;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
