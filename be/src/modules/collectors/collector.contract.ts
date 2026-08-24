import type { Relevance } from '@/modules/mentions/entities/mention.entity';
import type { SourceConfig } from '@/modules/sources/source-config.schema';

/**
 * 어댑터 계약 (docs/data-collection-design.md §4). 소스 추가 비용 = 파일 1개.
 *
 * 어댑터는 **플랫폼 단위**다 — `shopify` 하나가 스토어 3곳을 담당한다.
 * `source` 행은 사이트 단위이고, 차이는 `config`가 흡수한다.
 */
export interface CollectorAdapter {
  /** `source.platform`과 맞춰 어댑터를 고른다 */
  readonly platform: string;

  /**
   * `since` = 마지막 성공 시각. 같은 입력이면 같은 `external_id`가 나와야 한다 (멱등성).
   *
   * 예외를 삼키지 않는다 — 소스 단위로 격리해 1개 실패가 전체를 막지 않게 하는 건
   * 호출자의 책임이다. 어댑터는 그냥 던진다.
   */
  collect(input: CollectInput): Promise<CollectedMention[]>;
}

export interface CollectInput {
  readonly sourceId: string;
  readonly baseUrl: string;
  readonly config: SourceConfig;
  /** 첫 수집이면 `null` */
  readonly since: Date | null;
  /** robots.txt 준수값. 동시 요청은 항상 1이다 */
  readonly crawlDelaySec: number;
}

/**
 * 어댑터 출력. `mention` 행이 되기 전 형태다.
 * 원문 전재 금지 — **제목 · 가격 · 날짜 · 링크만** (docs/data-collection-design.md §4.1).
 */
export interface CollectedMention {
  readonly externalId: string;
  readonly url: string;
  readonly rawTitle: string;
  readonly rawPayload: Record<string, unknown>;
  readonly relevance: Relevance;
}
