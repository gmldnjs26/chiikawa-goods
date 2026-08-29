/**
 * 픽스처 채집 (docs/data-collection-design.md §4.1).
 *
 * 파서는 저장된 원문으로 개발한다. 개발 중에 실제 사이트를 반복 호출하지 않는다.
 * **`curl`로 받지 않는다** — UA·robots·간격이 빠진 요청은 규범 위반이고,
 * 이 스크립트 자체가 규범 레이어의 첫 실전 검증이다.
 *
 *   ./node_modules/.bin/ts-node -r tsconfig-paths/register scripts/capture-fixtures.ts <base-url> <slug>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  extractCollectionHandles,
  pickCollectionSitemaps,
} from '@/modules/collectors/adapters/shopify/sitemap';
import { HttpFetcherService } from '@/modules/http/http-fetcher.service';
import { RobotsService } from '@/modules/http/robots.service';

/** 채집은 조사이지 수집이 아니다. 컬렉션 2개면 파서 개발에 충분하다 */
const COLLECTION_SAMPLE = 2;
const PRODUCT_SAMPLE = 8;
const CRAWL_DELAY_SEC = 3;

/**
 * 저장소는 public이다. 설명문·이미지를 그대로 커밋하면 **원문 전재**다
 * (docs/data-collection-design.md §4.1, plan.md §1.4).
 * 파서가 실제로 읽는 필드만 남긴다 — 판정 근거는 태그와 `available`이지 본문이 아니다.
 */
const KEEP_PRODUCT_KEYS = [
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
const KEEP_VARIANT_KEYS = ['id', 'sku', 'price', 'available', 'taxable', 'title'] as const;

async function main(): Promise<void> {
  const [baseUrl, slug] = process.argv.slice(2);
  if (!baseUrl || !slug) throw new Error('사용법: capture-fixtures.ts <base-url> <slug>');

  const robots = new RobotsService();
  const fetcher = new HttpFetcherService(robots);
  const outDir = join(__dirname, '..', 'test', 'fixtures', slug);
  mkdirSync(outDir, { recursive: true });

  const delay = await robots.crawlDelaySec(new URL(baseUrl));
  console.log(`robots Crawl-delay = ${delay ?? '없음'} (실제 사용값 ${Math.max(delay ?? 0, CRAWL_DELAY_SEC)}초)`);

  const options = { crawlDelaySec: CRAWL_DELAY_SEC };

  const index = await fetcher.fetchText(`${baseUrl}/sitemap.xml`, options);
  save(outDir, 'sitemap.xml', index.body);

  // 어댑터와 같은 코드로 고른다 — 채집과 수집이 다른 경로를 타면 픽스처가 거짓말을 한다
  const [collectionsUrl] = pickCollectionSitemaps(index.url, index.body);
  if (!collectionsUrl) throw new Error('컬렉션 sitemap을 찾지 못했다');
  console.log(`컬렉션 sitemap: ${collectionsUrl}`);

  const collections = await fetcher.fetchText(collectionsUrl, options);
  save(outDir, 'sitemap_collections.xml', collections.body);

  const handles = extractCollectionHandles(collections.url, collections.body);

  console.log(`컬렉션 ${handles.length}개. 앞 ${COLLECTION_SAMPLE}개만 받는다`);

  for (const handle of handles.slice(0, COLLECTION_SAMPLE)) {
    const products = await fetcher.fetchText(
      `${baseUrl}/collections/${handle}/products.json?limit=250`,
      options,
    );
    const parsed = JSON.parse(products.body) as { products: Record<string, unknown>[] };
    // 앞 페이지가 가득 찼다는 것은 "끝"이 아니라 "다음 페이지가 있다"는 뜻이다.
    // 채집은 표본이면 되지만 어댑터는 반드시 페이지를 넘겨야 한다
    console.log(`  ${handle}: products ${parsed.products.length}건 (limit=250)`);
    save(outDir, `products-${handle}.json`, JSON.stringify(redact(parsed), null, 2));
  }
}

function redact(payload: { products: Record<string, unknown>[] }): unknown {
  return {
    products: payload.products.slice(0, PRODUCT_SAMPLE).map((product) => ({
      ...pick(product, KEEP_PRODUCT_KEYS),
      variants: (product.variants as Record<string, unknown>[] | undefined)?.map((variant) =>
        pick(variant, KEEP_VARIANT_KEYS),
      ),
    })),
  };
}

function pick(source: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => key in source).map((key) => [key, source[key]]));
}

function save(dir: string, name: string, body: string): void {
  writeFileSync(join(dir, name), body, 'utf-8');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
