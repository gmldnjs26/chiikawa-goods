import { parseJsonBody } from '@/modules/_common/fetcher/utils/body-validation';

import type { ShopifyProduct } from '../dto/shopify-product.dto';
import { keepAllowedFields } from './payload-whitelist';

/** `products.json` 1페이지 상한. 250건이 오면 "끝"이 아니라 "다음 페이지"다 */
export const PAGE_SIZE = 250;


/**
 * 응답 검증 + 파싱 (docs/data-collection-design.md §7).
 * 상태 코드를 믿지 않는다 — 200 + 공통 SPA HTML을 실제로 봤다.
 */
export function parseProductsPage(url: string, body: string): ShopifyProduct[] {
  const parsed = parseJsonBody<{ products: unknown }>(url, body, ['products']);
  if (!Array.isArray(parsed.products)) {
    throw new Error(`products가 배열이 아니다 — ${url}`);
  }

  // **경계에서 거른다.** 하류에 `body_html`이 든 형태 자체를 존재시키지 않는다.
  // 저장 직전 한 줄에 의존하면 그 한 줄이 사라졌을 때 아무 테스트도 울지 않는다
  return (parsed.products as Record<string, unknown>[]).map(
    (product) => keepAllowedFields(product) as unknown as ShopifyProduct,
  );
}

/** 250건이면 다음 페이지가 있다. 여기서 멈추면 조용한 누락이다 */
export function hasNextPage(page: ShopifyProduct[]): boolean {
  return page.length >= PAGE_SIZE;
}
