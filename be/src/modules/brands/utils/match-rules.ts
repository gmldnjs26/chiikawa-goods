/**
 * 브랜드 판정 (docs/source-mapping.md §4, docs/data-collection-design.md §9.4).
 *
 * 규칙은 코드가 아니라 `brand.match_rules`에 있다 — 브랜드는 계속 늘어나고,
 * 규칙 수정에 배포가 필요해지면 안 된다.
 *
 * **`vendor`를 브랜드로 쓰지 않는다.** `グレイ・パーカー・サービス`는 제조사다. 유저는 모른다.
 */
export interface MatchRules {
  readonly tags: string[];
  readonly collections: string[];
  readonly titlePatterns: string[];
}

export interface BrandCandidate {
  readonly id: string;
  readonly rules: MatchRules;
  /** 같은 단계에서 여러 개가 걸리면 이 값이 작은 쪽. 판정이 실행 순서에 흔들리면 안 된다 */
  readonly sortOrder: number;
}

export interface BrandInput {
  readonly tags: readonly string[];
  readonly collections: readonly string[];
  readonly title: string;
}

/**
 * 태그 → 컬렉션 → 제목 순. **실패하면 `null`(미판정)이다.**
 * 화면에는 `その他`로 **보여준다** — 목록에서 빼지 않는다.
 */
export function judgeBrand(input: BrandInput, candidates: readonly BrandCandidate[]): string | null {
  const tags = new Set(input.tags);
  const collections = new Set(input.collections);

  // 단계가 우선이고, 같은 단계 안에서 sort_order다.
  // 섞으면 sort_order가 작은 브랜드의 약한 근거(제목)가 강한 근거(태그)를 이긴다
  const byStage = [
    (rules: MatchRules) => rules.tags.some((tag) => tags.has(tag)),
    (rules: MatchRules) => rules.collections.some((handle) => collections.has(handle)),
    (rules: MatchRules) => rules.titlePatterns.some((pattern) => safeTest(pattern, input.title)),
  ];

  const ordered = [...candidates].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const matches of byStage) {
    const hit = ordered.find((candidate) => matches(candidate.rules));
    if (hit !== undefined) return hit.id;
  }
  return null;
}

/** `match_rules`는 DB에서 온 jsonb다. 형태가 어긋나면 그 규칙만 버린다 */
export function parseMatchRules(value: unknown): MatchRules {
  const source = isRecord(value) ? value : {};

  return {
    tags: stringArray(source.tags),
    collections: stringArray(source.collections),
    titlePatterns: stringArray(source.title_patterns).filter(isCompilable),
  };
}

/** 규칙 하나가 깨졌다고 판정 전체를 멈추지 않는다 — 미판정은 안전한 실패다 */
function safeTest(pattern: string, text: string): boolean {
  try {
    return new RegExp(pattern).test(text);
  } catch {
    return false;
  }
}

function isCompilable(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
