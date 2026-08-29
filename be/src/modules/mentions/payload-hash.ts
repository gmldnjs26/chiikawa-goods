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
 * 제외 필드는 두지 않는다. Shopify `updated_at`도 포함한다 —
 * 내용이 같고 `updated_at`만 바뀌어도 "상대가 무언가 갱신했다"는 관측이다.
 */
export function payloadHash(payload: unknown): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

/** 해시 입력용 문자열. 저장하는 `raw_payload`는 원래 모양 그대로 둔다 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value === null || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(source)
      .sort()
      .map((key) => [key, sortDeep(source[key])]),
  );
}
