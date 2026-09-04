import { Injectable, Logger } from '@nestjs/common';

import { FetcherService } from '@/modules/_common/fetcher/fetcher.service';
import type { CollectInput } from '@/modules/collectors/dto/collect-input.dto';
import type { CollectedMention } from '@/modules/collectors/dto/collected-mention.dto';
import type { CollectorAdapter } from '@/modules/collectors/interfaces/collector-adapter.interface';

import type { ShopifyProduct } from './dto/shopify-product.dto';
import { selectCollections } from './utils/collection-select';
import { hasNextPage, PAGE_SIZE, parseProductsPage } from './utils/products-page';
import { judgeRelevance } from './utils/relevance';
import { extractCollectionHandles, pickCollectionSitemaps } from './utils/sitemap';

/** 컬렉션 하나가 이 이상 페이지를 넘기면 규칙이 잘못된 것이다. 무한 루프를 막는다 */
const MAX_PAGES = 20;

/**
 * Shopify 어댑터 (docs/source-mapping.md §1).
 *
 * **플랫폼 1개 = 어댑터 1개.** 스토어 3곳이 이걸 공유하고 차이는 `config`가 흡수한다.
 * 소스 추가 비용 = `source` 행 1개 + migration 1개, 코드 변경 없음.
 */
@Injectable()
export class ShopifyAdapter implements CollectorAdapter {
  readonly platform = 'shopify';
  private readonly logger = new Logger(ShopifyAdapter.name);

  constructor(private readonly fetcher: FetcherService) {}

  /**
   * `input.since`로 거르지 않는다. `updated_at`을 믿고 자르면 재입고(`available` 전이)를
   * 놓친다 — 변경 판정은 `payload_hash`가 한다 (docs/source-mapping.md §1).
   */
  async collect(input: CollectInput): Promise<CollectedMention[]> {
    const handles = await this.discoverHandles(input);
    const { handles: targets, dropped } = selectCollections(handles, input.config, new Date());
    this.logger.log(`컬렉션 ${handles.length}개 중 ${targets.length}개를 돈다`);
    if (dropped > 0) {
      // 조용히 자르지 않는다. 상한이 실제로 물렸다는 신호가 없으면 "전부 돌았다"로 읽힌다
      this.logger.warn(`상한(max_collections)에 걸려 ${dropped}개를 이번 실행에서 뺐다`);
    }

    /** 같은 상품이 여러 컬렉션에 있다. 컬렉션마다 mention을 만들면 중복된다 */
    const byProductId = new Map<number, { product: ShopifyProduct; collections: string[] }>();

    for (const handle of targets) {
      for (const product of await this.fetchCollection(input, handle)) {
        const merged = byProductId.get(product.id);
        if (merged) merged.collections.push(handle);
        else byProductId.set(product.id, { product, collections: [handle] });
      }
    }

    return [...byProductId.values()].map(({ product, collections }) =>
      this.toMention(input, product, collections),
    );
  }

  private async discoverHandles(input: CollectInput): Promise<string[]> {
    const indexUrl = `${input.baseUrl}/sitemap.xml`;
    const index = await this.fetch(input, indexUrl);
    const sitemaps = pickCollectionSitemaps(index.url, index.body);

    const handles: string[] = [];
    for (const url of sitemaps) {
      const child = await this.fetch(input, url);
      handles.push(...extractCollectionHandles(child.url, child.body));
    }
    return [...new Set(handles)];
  }

  /** 250건은 "끝"이 아니라 "다음 페이지"다. 여기서 멈추면 조용한 누락이 된다 */
  private async fetchCollection(input: CollectInput, handle: string): Promise<ShopifyProduct[]> {
    const products: ShopifyProduct[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const url = `${input.baseUrl}/collections/${handle}/products.json?limit=${PAGE_SIZE}&page=${page}`;
      const response = await this.fetch(input, url);
      const parsed = parseProductsPage(response.url, response.body);

      products.push(...parsed);
      if (!hasNextPage(parsed)) return products;
    }

    // 여기 오면 규칙이 틀렸다. 조용히 자르지 않고 남긴다
    this.logger.warn(`${handle}: ${MAX_PAGES}페이지를 넘겼다. 잘렸을 수 있다`);
    return products;
  }

  private fetch(input: CollectInput, url: string) {
    return this.fetcher.fetchText(url, { crawlDelaySec: input.crawlDelaySec });
  }

  private toMention(
    input: CollectInput,
    product: ShopifyProduct,
    collections: string[],
  ): CollectedMention {
    const tags = Array.isArray(product.tags) ? product.tags : [];
    // 순회 순서는 보장되지 않는다. 정렬하지 않으면 무변경인데도 해시가 흔들린다
    const sorted = [...new Set(collections)].sort();

    const relevance = judgeRelevance({ tags, collections: sorted }, input.config);

    return {
      // `handle`이 아니다 — handle은 바뀔 수 있다
      externalId: String(product.id),
      url: `${input.baseUrl}/products/${product.handle}`,
      rawTitle: product.title,
      // 걸러내기는 `parseProductsPage`에서 이미 끝났다 (payload-fields.ts).
      // 여기서 또 부르지 않는다 — 두 곳에 두면 한쪽이 사라져도 안 울린다
      rawPayload:
        relevance === 'excluded'
          ? // 제외분은 줄여서 남긴다 (docs/source-mapping.md §7.3). 용량 때문이지만
            // NULL로 만들지는 않는다 — 규칙을 고쳐 재처리하는 것이 유일한 복구 경로이고,
            // 재처리에 필요한 것이 태그와 컬렉션이다. 제목·URL은 이미 컬럼에 있다
            { tags, _collections: sorted }
          : { ...product, _collections: sorted },
      relevance,
    };
  }
}
