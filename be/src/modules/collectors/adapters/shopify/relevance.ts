import type { Relevance } from '@/modules/mentions/entities/mention.entity';
import type { SourceConfig } from '@/modules/sources/source-config.schema';

export interface RelevanceInput {
  readonly tags: string[];
  readonly collections: string[];
}

/**
 * 관련성 판정 (docs/source-mapping.md §7).
 *
 * `nagano-market.jp`는 ちいかわ 전용이 아니다 — 나가노의 다른 작품이 같은 피드에 섞인다.
 * 필터가 없는 소스는 전부 `included`다.
 *
 * **`excluded`도 행은 남긴다.** 필터 규칙이 틀렸을 때 재처리로 복구하기 위해서다.
 */
export function judgeRelevance(input: RelevanceInput, config: SourceConfig): Relevance {
  const filter = config.relevance_filter;
  if (filter === undefined) return 'included';

  const tags = new Set(input.tags);
  const collections = new Set(input.collections);

  const included =
    filter.include_tags.some((tag) => tags.has(tag)) ||
    filter.include_collections.some((handle) => collections.has(handle));

  if (!included) return 'excluded';

  // 치이카와 신호와 다른 작품 신호가 함께 있으면 단정하지 않는다.
  // 화면에 `他キャラ混在` 라벨로 내보내고 판단은 사람이 한다
  const mixed = filter.mixed_marker_tags.some((tag) => tags.has(tag));
  return mixed ? 'mixed' : 'included';
}
