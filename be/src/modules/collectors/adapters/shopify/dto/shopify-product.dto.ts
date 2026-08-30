/** `products.json`의 상품 1건. 저장 전에 화이트리스트로 걸러진 형태다 */
export interface ShopifyProduct {
  readonly id: number;
  readonly handle: string;
  readonly title: string;
  readonly tags?: string[];
  readonly [key: string]: unknown;
}
