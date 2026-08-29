import { parseJsonBody } from '@/modules/http/body-validation';

/** `products.json` 1페이지 상한. 250건이 오면 "끝"이 아니라 "다음 페이지"다 */
export const PAGE_SIZE = 250;

export interface ShopifyProduct {
  readonly id: number;
  readonly handle: string;
  readonly title: string;
  readonly tags?: string[];
  readonly [key: string]: unknown;
}

/**
 * 응답 검증 + 파싱 (docs/data-collection-design.md §7).
 * 상태 코드를 믿지 않는다 — 200 + 공통 SPA HTML을 실제로 봤다.
 */
export function parseProductsPage(url: string, body: string): ShopifyProduct[] {
  const parsed = parseJsonBody<{ products: unknown }>(url, body, ['products']);
  if (!Array.isArray(parsed.products)) {
    throw new Error(`products가 배열이 아니다 — ${url}`);
  }
  return parsed.products as ShopifyProduct[];
}

/** 250건이면 다음 페이지가 있다. 여기서 멈추면 조용한 누락이다 */
export function hasNextPage(page: ShopifyProduct[]): boolean {
  return page.length >= PAGE_SIZE;
}
