import type { Relevance } from '@/modules/mentions/entities/mention.entity';

/**
 * 어댑터 출력. `mention` 행이 되기 전 형태다.
 * 원문 전재 금지 — **제목 · 가격 · 날짜 · 링크만** (docs/data-collection-design.md §4.1).
 */
export interface CollectedMention {
  /** 소스 고유 ID. 같은 입력이면 같은 값이어야 한다 (멱등성) */
  readonly externalId: string;
  readonly url: string;
  readonly rawTitle: string;
  readonly rawPayload: Record<string, unknown>;
  readonly relevance: Relevance;
}
