import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { inList } from '@/modules/_common/enum-check';
import { Brand } from '@/modules/brands/entities/brand.entity';
import { DropGroup } from '@/modules/drop-groups/entities/drop-group.entity';

/** 상태는 3개뿐이다. `RESTOCK`은 상태가 아니라 `ENDED → ON_SALE` 전이다 (§3.4) */
export const ITEM_STATUSES = ['UPCOMING', 'ON_SALE', 'ENDED'] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const CHANNELS = [
  'online_official',
  'konbini',
  'arcade',
  'gacha',
  'kuji',
  'store',
  'apparel',
] as const;
export type Channel = (typeof CHANNELS)[number];

export const ACQUISITIONS = ['fixed', 'random'] as const;
export type Acquisition = (typeof ACQUISITIONS)[number];

/**
 * 정규화된 굿즈 (docs/db-schema.md §5.2). **가변이다** —
 * 정규화가 틀렸으면 `mention`이 아니라 여기를 고친다.
 *
 * `item` = Shopify product 1개. variant로 쪼개지 않는다 (docs/source-mapping.md §2.1).
 */
@Entity('item')
// 랜덤인데 종류 수가 없는 카드는 저장되지 않는다 (docs/plan.md §6.3 카드 규약)
@Check('CHK_item_random_total', `"acquisition" <> 'random' OR "series_total" IS NOT NULL`)
@Check('CHK_item_store_region', `"channel" <> 'store' OR "region" <> 'online'`)
@Check('CHK_item_status', inList('status', ITEM_STATUSES))
@Check('CHK_item_channel', inList('channel', CHANNELS))
@Check('CHK_item_acquisition', inList('acquisition', ACQUISITIONS))
// 화면 질의는 억제된 행을 보지 않는다. 부분 인덱스라 억제분이 인덱스에 실리지 않는다
@Index(['status', 'releaseOn'], { where: '"suppressed_at" IS NULL' })
@Index(['channel'], { where: '"suppressed_at" IS NULL' })
@Index(['brandId'], { where: '"suppressed_at" IS NULL' })
@Index(['titleNorm'])
// 배열 포함 검색(`labels @> ARRAY['川越店限定']`)은 btree로 안 걸린다.
// `type`은 TypeORM 1의 IndexOptions에 있다 (node_modules/typeorm/decorator/options/IndexOptions.d.ts)
@Index(['labels'], { type: 'gin' })
export class Item {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  /** NULL 허용. 묶이지 않은 item도 화면에 단독으로 나온다 (§6) */
  @Column({ type: 'bigint', nullable: true })
  dropId!: string | null;

  @ManyToOne(() => DropGroup, { nullable: true })
  @JoinColumn({ name: 'drop_id' })
  drop!: DropGroup | null;

  /** NULL = 미판정. 화면에는 `その他`로 **보여준다.** 목록에서 빼지 않는다 */
  @Column({ type: 'bigint', nullable: true })
  brandId!: string | null;

  @ManyToOne(() => Brand, { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand!: Brand | null;

  @Column({ type: 'text' })
  title!: string;

  /** 정규화 제목. 소스 간 dedupe 2단계 근거 (docs/data-collection-design.md §9.2) */
  @Column({ type: 'text' })
  titleNorm!: string;

  /** 소스 간 동일 판정 1순위 */
  @Column({ type: 'text', unique: true, nullable: true })
  canonicalUrl!: string | null;

  @Column({ type: 'text' })
  officialUrl!: string;

  /** 원본 CDN URL. 파일은 갖지 않는다 (docs/plan.md §2.1) */
  @Column({ type: 'text', nullable: true })
  imageUrl!: string | null;

  /** JPY 정수. variant 간 차이가 있으면 최저가 */
  @Column({ type: 'integer', nullable: true })
  price!: number | null;

  @Column({ type: 'boolean', default: false })
  priceVaries!: boolean;

  @Column({ type: 'boolean', nullable: true })
  priceTaxIncluded!: boolean | null;

  /** `一部品切れ` 표시용. 사이즈 단위 알림은 보내지 않는다 — 스팸이다 */
  @Column({ type: 'integer', nullable: true })
  variantAvailable!: number | null;

  @Column({ type: 'integer', nullable: true })
  variantTotal!: number | null;

  /** Shopify product_type 원문 */
  @Column({ type: 'text', nullable: true })
  category!: string | null;

  /** 제조사. **브랜드가 아니다** — 유저는 `グレイ・パーカー・サービス`를 모른다 */
  @Column({ type: 'text', nullable: true })
  vendor!: string | null;

  /** source에서 파생하지만 비정규화해 둔다 — 병합 시 소스가 여럿이 된다 (§5.2) */
  @Column({ type: 'text' })
  channel!: Channel;

  @Column({ type: 'text' })
  acquisition!: Acquisition;

  @Column({ type: 'integer', nullable: true })
  seriesTotal!: number | null;

  /** `내가 그 장소에 가야 하는가`일 때만 쓴다. `川越店限定`은 labels다 (§5.2) */
  @Column({ type: 'text', default: 'online' })
  region!: string;

  @Column({ type: 'text', array: true, default: () => `'{}'` })
  labels!: string[];

  @Column({ type: 'text' })
  status!: ItemStatus;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  statusAt!: Date;

  /** JST 달력일. 판정 못 한 값은 비운다 — 추측으로 채우지 않는다 */
  @Column({ type: 'date', nullable: true })
  preorderOn!: string | null;

  @Column({ type: 'date', nullable: true })
  releaseOn!: string | null;

  /** 개시 시각은 사이트에 없다. 실측 히스토그램 기반 추정이다 (§3.5) */
  @Column({ type: 'boolean', default: true })
  timeEstimated!: boolean;

  @Column({ type: 'date', nullable: true })
  availableUntil!: string | null;

  /** 삭제 요청 대응. **하드 삭제하지 않는다** */
  @Column({ type: 'timestamptz', nullable: true })
  suppressedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  suppressedReason!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
