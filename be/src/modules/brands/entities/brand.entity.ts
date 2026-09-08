import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 브랜드 룩업 (docs/db-schema.md §5.1).
 * 브랜드는 계속 늘어나므로 CHECK가 아니라 테이블이다. 판정 규칙도 코드가 아니라 `match_rules`다.
 * 초기 시드는 `SeedBrands` migration — 스토어 브랜드 5개 (docs/plan.md §6.6). 시리즈는 브랜드가 아니라 라벨이다.
 */
@Entity('brand')
export class Brand {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'text', unique: true })
  code!: string;

  @Column({ type: 'text' })
  labelJa!: string;

  /** 태그/컬렉션/제목/소스 매칭 규칙 (utils/match-rules.ts) */
  @Column({ type: 'jsonb', nullable: true })
  matchRules!: Record<string, unknown> | null;

  @Column({ type: 'integer', default: 100 })
  sortOrder!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
