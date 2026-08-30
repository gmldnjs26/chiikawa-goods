import type { CollectInput } from '../dto/collect-input.dto';
import type { CollectedMention } from '../dto/collected-mention.dto';

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
   * 예외를 삼키지 않는다 — 소스 단위로 격리해 1개 실패가 전체를 막지 않게 하는 건
   * 호출자의 책임이다. 어댑터는 그냥 던진다.
   */
  collect(input: CollectInput): Promise<CollectedMention[]>;
}
