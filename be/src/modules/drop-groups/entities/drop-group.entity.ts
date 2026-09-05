import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

import { inList } from '@/modules/_common/enum-check';

/** docs/source-mapping.md §5.1. 판정은 컬렉션 title로 한다 — 핸들 접두어는 어긋난 사례가 있다 */
export const DROP_KINDS = ['preorder', 'release', 'restock', 'campaign'] as const;
export type DropKind = (typeof DROP_KINDS)[number];

/**
 * 발표 단위 (docs/db-schema.md §6). 유저가 보는 단위이자 알림 단위다 —
 * 굿즈 20종을 알림 20개로 보내면 스팸이다.
 *
 * 도메인 용어는 `drop`이지만 **`drop`은 SQL 예약어**다. 테이블명이 `drop_group`인 이유다.
 */
@Entity('drop_group')
@Check('CHK_drop_group_kind', inList('kind', DROP_KINDS))
@Index(['primaryDate'])
export class DropGroup {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  /** 컬렉션 title에서 온다. 날짜+브랜드 묶음에는 근거가 없어 비운다 — 화면은 primary_date+kind로 낸다 */
  @Column({ type: 'text', nullable: true })
  title!: string | null;

  @Column({ type: 'text' })
  kind!: DropKind;

  /** 컬렉션 핸들에서 파싱하지 않는다 — 소속 상품의 발매 태그에서 온다 (§5.3) */
  @Column({ type: 'date', nullable: true })
  primaryDate!: string | null;

  /** 자동 묶음 근거. 컬렉션 handle 또는 `date:brand:kind`. 말미 `_`는 제거한다 (§5.4) */
  @Column({ type: 'text', nullable: true, unique: true })
  groupingKey!: string | null;

  @Column({ type: 'boolean', default: false })
  isManual!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
