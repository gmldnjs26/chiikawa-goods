import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 브랜드 룩업 (docs/db-schema.md §5.1).
 * 브랜드는 계속 늘어나므로 CHECK가 아니라 테이블이다. 판정 규칙도 코드가 아니라 `match_rules`다.
 * 초기 시드는 넣지 않는다 — 목록과 규칙이 미결정이다 (§14 #2).
 */
@Entity('brand')
export class Brand {
  @PrimaryGeneratedColumn('identity', { type: 'bigint', generatedIdentity: 'ALWAYS' })
  id!: string;

  @Column({ type: 'text', unique: true })
  code!: string;

  @Column({ type: 'text' })
  labelJa!: string;

  /** 컬렉션/태그/제목 매칭 규칙 */
  @Column({ type: 'jsonb', nullable: true })
  matchRules!: Record<string, unknown> | null;

  @Column({ type: 'integer', default: 100 })
  sortOrder!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
