/**
 * `raw_payload`에 남기는 필드 (docs/source-mapping.md §1).
 *
 * **원문 전재 금지 — 제목 · 가격 · 날짜 · 링크만** (docs/data-collection-design.md §4.1).
 * `body_html`(설명문 전문)과 `images`는 저작물이라 저장하지 않는다.
 * 해시 UNIQUE 때문에 설명문이 한 글자 바뀔 때마다 전문이 든 행이 또 쌓인다는 점에서도 나쁘다.
 *
 * 픽스처 채집과 수집이 **같은 목록**을 본다. 두 곳에 적으면 반드시 어긋난다.
 */
export const KEEP_PRODUCT_KEYS = [
  'id',
  'handle',
  'title',
  'published_at',
  'created_at',
  'updated_at',
  'vendor',
  'product_type',
  'tags',
] as const;

export const KEEP_VARIANT_KEYS = ['id', 'sku', 'price', 'available', 'taxable', 'title'] as const;

/** 화이트리스트 밖은 버린다. 「무엇을 빼는가」가 아니라 「무엇만 남기는가」다 */
export function keepAllowedFields(product: Record<string, unknown>): Record<string, unknown> {
  const kept = pick(product, KEEP_PRODUCT_KEYS);
  const variants = product.variants;

  if (Array.isArray(variants)) {
    kept.variants = variants.map((variant) =>
      pick(variant as Record<string, unknown>, KEEP_VARIANT_KEYS),
    );
  }
  return kept;
}

function pick(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
}
