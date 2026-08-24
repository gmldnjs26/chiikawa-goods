import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { inList } from '../../_common/enum-check';

/** docs/db-schema.md §2. 값을 늘리면 CHECK migration이 필요하다 */
export const SOURCE_KINDS = [
  'official_store',
  'fan_blog',
  'press',
  'konbini',
  'prize',
  'gacha',
  'apparel',
  'retail',
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const FETCH_KINDS = ['json', 'rss', 'atom', 'html', 'sitemap'] as const;
export type FetchKind = (typeof FETCH_KINDS)[number];

/**
 * 소스 레지스트리 (docs/db-schema.md §2).
 * `platform`이 어댑터를 고르고 `config`가 사이트별 차이를 흡수한다.
 * `source.last_success_at`을 두지 않는다 — `collection_run`에서 파생되는 값이다.
 */
@Entity('source')
@Check('CHK_source_kind', inList('kind', SOURCE_KINDS))
@Check('CHK_source_fetch_kind', inList('fetch_kind', FETCH_KINDS))
export class Source {
  /** pg bigint는 드라이버가 string으로 돌려준다. number로 선언하면 거짓말이 된다 */
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'text', unique: true })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  kind!: SourceKind;

  /** 어댑터 선택 키. 'shopify' 하나가 스토어 3곳을 담당한다 */
  @Column({ type: 'text' })
  platform!: string;

  @Column({ type: 'text' })
  fetchKind!: FetchKind;

  /** 사이트별 파싱 규칙. 스키마는 zod로 로드 시점에 검증한다 (docs/source-mapping.md §6) */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  config!: Record<string, unknown>;

  @Column({ type: 'text' })
  baseUrl!: string;

  /** 이 소스에서 나온 item의 기본 채널 (docs/db-schema.md §5) */
  @Column({ type: 'text' })
  channel!: string;

  @Column({ type: 'integer' })
  intervalSec!: number;

  /** robots.txt 준수값 */
  @Column({ type: 'integer', default: 0 })
  crawlDelaySec!: number;

  /** 소스 단위 킬 스위치. 403/429/챌린지 수신 시 애플리케이션이 스스로 내린다 */
  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @Column({ type: 'text', nullable: true })
  disabledReason!: string | null;

  /** 이 시간 이상 신규가 없으면 무음 경보. 소스마다 기대 빈도가 다르다 */
  @Column({ type: 'integer', nullable: true })
  silenceAlertSec!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
