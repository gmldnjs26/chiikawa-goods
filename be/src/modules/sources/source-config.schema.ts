import { z } from 'zod';

/**
 * `source.config` 스키마 (docs/source-mapping.md §6).
 *
 * 코드는 스토어마다 동일하고 규칙 차이만 여기로 들어온다.
 * 규칙이 `null`이면 해당 판정을 **건너뛴다** — 값을 추측해서 채우지 않는다.
 */

/**
 * 태그 규칙은 3형태다 — `chiikawamarket.jp`는 문자열 하나,
 * `nagano-market.jp`의 `restock_tag`는 `["^RE(\\d{8})$", "^RE(\\d{6})$"]` 배열,
 * `chiikawamogumogu.shop`은 `null`(미지원). 하나로 좁히면 시드 시점에 터진다.
 */
const tagRule = z.union([z.string(), z.array(z.string()).min(1)]).nullable();

/** 정규식으로 쓰이므로 컴파일 가능한지 로드 시점에 확인한다 */
const regexRule = tagRule.refine(
  (value) => toPatterns(value).every(isCompilableRegex),
  '정규식으로 컴파일되지 않는 패턴이 있다',
);

const relevanceFilter = z.object({
  include_tags: z.array(z.string()).default([]),
  include_collections: z.array(z.string()).default([]),
  /** 함께 있으면 relevance='mixed' + 他キャラ混在 라벨 */
  mixed_marker_tags: z.array(z.string()).default([]),
});

export const sourceConfigSchema = z.object({
  release_tag: regexRule.default(null),
  preorder_tag: regexRule.default(null),
  restock_tag: regexRule.default(null),
  /** 정규식이 아니라 태그 리터럴이다 */
  upcoming_tag: tagRule.default(null),

  tax_included: z.boolean().default(true),
  default_acquisition: z.string().default('fixed'),
  default_region: z.string().default('online'),

  /** 무음 감지용. 지원하지 않는 소스에 "예약이 0건"은 이상이 아니다 */
  supports_preorder_detection: z.boolean().default(false),
  supports_restock_backfill: z.boolean().default(false),

  relevance_filter: relevanceFilter.optional(),

  /** 캐릭터 태그는 40종 이상 계속 늘어나므로 config에 나열하지 않고 룩업을 참조한다 */
  label_tag_source: z.literal('character_table').optional(),
  label_tags: z.array(z.string()).default([]),
  label_tags_extra: z.array(z.string()).default([]),
  /** 라벨로 쓰지 않고 버리는 운영용 태그 */
  drop_tags: z.array(z.string()).default([]),
});

export type SourceConfig = z.infer<typeof sourceConfigSchema>;

/** 문자열·배열·null을 한 형태로 편다. 호출부가 3분기하지 않게 한다 */
export function toPatterns(value: string | string[] | null | undefined): string[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function isCompilableRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}
