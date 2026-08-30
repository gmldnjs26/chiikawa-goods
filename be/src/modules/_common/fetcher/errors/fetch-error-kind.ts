/**
 * 요청이 실패한 **종류**.
 *
 * `_common/`은 특정 도메인을 모른다 (be/CLAUDE.md §2). 그래서 여기서 자체 정의하고,
 * `collection_run.failure_kind`로 옮기는 것은 도메인 쪽 책임이다.
 * 예전에는 이 파일이 `collection-runs` 엔티티를 import했다 — HTTP 층이 수집 도메인을
 * 알고 있었다는 뜻이고, 의존 방향이 뒤집혀 있었다.
 */
export const FETCH_ERROR_KINDS = [
  /** 연결 실패 · 타임아웃 */
  'network',
  /** 4xx · 5xx */
  'http',
  /** 상태 코드는 정상인데 본문이 기대와 다르다 (소프트 404) */
  'validation',
  /** 본문 형식은 맞는데 해석할 수 없다 */
  'parse',
  /** 상대가 우리를 막았다 (403 · 429 · 챌린지) */
  'blocked',
] as const;

export type FetchErrorKind = (typeof FETCH_ERROR_KINDS)[number];
