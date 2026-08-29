import { createHash } from 'node:crypto';

/**
 * `payload_hash` (docs/source-mapping.md §1).
 *
 * 이 값이 실행마다 흔들리면 무변경인데도 새 `mention`이 쌓인다 —
 * dedupe 버그처럼 보이지만 원인은 직렬화다. 흔들리는 원인은 2개다.
 *
 * 1. **키 순서** — `JSON.stringify`는 삽입 순서를 따른다. 컬렉션을 도는 순서가
 *    바뀌면 같은 내용이 다른 문자열이 된다 → 재귀적으로 키를 정렬한다
 * 2. **`_collections` 순서** — sitemap 순회 순서는 보장되지 않는다 → 정렬한다
 *
 * 3. **의미 없이 흔들리는 필드** — Shopify `updated_at`은 요청할 때마다 바뀐다.
 *    49초 간격 두 번에 622건 전부가 새 행이 됐다 (실측). `excludeKeys`로 뺀다.
 *    빼는 것은 **해시 입력뿐**이고 `raw_payload`는 원문 그대로 저장한다.
 */
export function payloadHash(payload: unknown, excludeKeys: readonly string[] = []): string {
  return createHash('sha256').update(canonicalize(payload, excludeKeys)).digest('hex');
}

/** 해시 입력용 문자열. 저장하는 `raw_payload`는 원래 모양 그대로 둔다 */
export function canonicalize(value: unknown, excludeKeys: readonly string[] = []): string {
  return JSON.stringify(sortDeep(value, new Set(excludeKeys)));
}

function sortDeep(value: unknown, exclude: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((entry) => sortDeep(entry, exclude));
  if (value === null || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      // 깊이 무관하게 뺀다 — `variants[].updated_at`이 같은 이름이다
      .filter((key) => !exclude.has(key))
      .map((key) => [key, sortDeep(source[key], exclude)]),
  );
}
