import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { FetcherService } from '@/modules/_common/fetcher/fetcher.service';
import type { CollectInput } from '@/modules/collectors/dto/collect-input.dto';
import { payloadHash } from '@/modules/mentions/utils/payload-hash';
import { sourceConfigSchema } from '@/modules/sources/dto/source-config.schema';

import { ShopifyAdapter } from './shopify.adapter';

const FIXTURES = join(__dirname, '..', '..', '..', '..', '..', 'test', 'fixtures');

function fixture(slug: string, name: string): string {
  return readFileSync(join(FIXTURES, slug, name), 'utf-8');
}

/** 픽스처를 URL로 돌려주는 가짜 fetcher. 테스트는 네트워크를 쓰지 않는다 */
function fakeFetcher(routes: Record<string, string>): FetcherService {
  const fetchText = jest.fn((url: string) => {
    const key = Object.keys(routes).find((pattern) => url.includes(pattern));
    if (key === undefined) throw new Error(`픽스처 없음: ${url}`);
    return Promise.resolve({ url, status: 200, body: routes[key], contentType: null });
  });
  return { fetchText } as unknown as FetcherService;
}

const productsPage = (products: unknown[]) => JSON.stringify({ products });

function input(overrides: Partial<CollectInput> = {}): CollectInput {
  return {
    sourceId: '1',
    baseUrl: 'https://chiikawamarket.jp',
    config: sourceConfigSchema.parse({ poll_collections: { always: ['newitems'] } }),
    since: null,
    crawlDelaySec: 0,
    ...overrides,
  };
}

describe('ShopifyAdapter', () => {
  it('실측 픽스처에서 mention을 만든다', async () => {
    const fetcher = fakeFetcher({
      '/sitemap.xml': fixture('chiikawamarket', 'sitemap.xml'),
      'sitemap_collections': fixture('chiikawamarket', 'sitemap_collections.xml'),
      '/collections/newitems/products.json': fixture('chiikawamarket', 'products-newitems.json'),
    });

    const mentions = await new ShopifyAdapter(fetcher).collect(input());

    expect(mentions.length).toBeGreaterThan(0);
    const first = mentions[0];
    // external_id는 product.id다. handle이 아니다
    expect(first.externalId).toMatch(/^\d+$/);
    expect(first.url).toMatch(/^https:\/\/chiikawamarket\.jp\/products\//);
    expect(first.rawTitle.length).toBeGreaterThan(0);
    expect(first.relevance).toBe('included');
  });

  it('로케일 사본 sitemap을 돌지 않는다', async () => {
    const fetcher = fakeFetcher({
      '/sitemap.xml': fixture('chiikawamarket', 'sitemap.xml'),
      'sitemap_collections': fixture('chiikawamarket', 'sitemap_collections.xml'),
      '/collections/newitems/products.json': productsPage([]),
    });

    await new ShopifyAdapter(fetcher).collect(input());

    const requested = (fetcher.fetchText as jest.Mock).mock.calls.map(([url]) => url as string);
    const localeCopies = requested.filter((url) => /\/(ko|zh-hans|zh-hant|en)\/sitemap/.test(url));
    expect(localeCopies).toEqual([]);
  });

  it('같은 상품이 여러 컬렉션에 있어도 mention은 1건이고 _collections에 모인다', async () => {
    const product = { id: 42, handle: 'h', title: 't', tags: [] };
    const fetcher = fakeFetcher({
      '/sitemap.xml': fixture('chiikawamarket', 'sitemap.xml'),
      'sitemap_collections': [
        '<?xml version="1.0"?><urlset>',
        '<url><loc>https://chiikawamarket.jp/collections/newitems</loc></url>',
        '<url><loc>https://chiikawamarket.jp/collections/20260821</loc></url>',
        '</urlset>',
      ].join(''),
      '/collections/newitems/products.json': productsPage([product]),
      '/collections/20260821/products.json': productsPage([product]),
    });

    const config = sourceConfigSchema.parse({
      poll_collections: { always: ['newitems'], date_pattern: '^(?:pre|re)?(\\d{8})', recent_days: 100000 },
    });
    const mentions = await new ShopifyAdapter(fetcher).collect(input({ config }));

    expect(mentions).toHaveLength(1);
    expect(mentions[0].rawPayload._collections).toEqual(['20260821', 'newitems']);
  });

  it('컬렉션 순서가 달라도 payload_hash가 같다', async () => {
    const product = { id: 42, handle: 'h', title: 't', tags: [] };
    const build = async (handles: string[]) => {
      const fetcher = fakeFetcher({
        '/sitemap.xml': fixture('chiikawamarket', 'sitemap.xml'),
        'sitemap_collections':
          `<?xml version="1.0"?><urlset>${handles
            .map((h) => `<url><loc>https://chiikawamarket.jp/collections/${h}</loc></url>`)
            .join('')}</urlset>`,
        'products.json': productsPage([product]),
      });
      const config = sourceConfigSchema.parse({
        poll_collections: { always: handles, date_pattern: null },
      });
      const [mention] = await new ShopifyAdapter(fetcher).collect(input({ config }));
      return payloadHash(mention.rawPayload);
    };

    expect(await build(['a-col', 'b-col'])).toBe(await build(['b-col', 'a-col']));
  });

  it('250건이면 다음 페이지를 이어 받는다 — 조용한 누락을 막는다', async () => {
    const page1 = Array.from({ length: 250 }, (_, i) => ({ id: i, handle: `h${i}`, title: 't', tags: [] }));
    const fetcher = jest.fn();
    const service = {
      fetchText: (url: string) => {
        fetcher(url);
        if (url.includes('/sitemap.xml')) {
          return Promise.resolve({ url, status: 200, body: fixture('chiikawamarket', 'sitemap.xml'), contentType: null });
        }
        if (url.includes('sitemap_collections')) {
          return Promise.resolve({
            url,
            status: 200,
            body: '<?xml version="1.0"?><urlset><url><loc>https://chiikawamarket.jp/collections/newitems</loc></url></urlset>',
            contentType: null,
          });
        }
        const body = url.includes('page=1') ? productsPage(page1) : productsPage([{ id: 999, handle: 'x', title: 't', tags: [] }]);
        return Promise.resolve({ url, status: 200, body, contentType: null });
      },
    } as unknown as FetcherService;

    const mentions = await new ShopifyAdapter(service).collect(input());

    expect(mentions).toHaveLength(251);
    expect(fetcher.mock.calls.some(([url]: [string]) => url.includes('page=2'))).toBe(true);
  });

  // docs/source-mapping.md §7.3 — 복구 경로는 「규칙을 고쳐 excluded를 재처리」다.
  // 태그와 컬렉션이 없으면 재처리할 수 없다. NULL이 아니라 축소다
  it('excluded는 payload를 줄이되 재처리에 필요한 것은 남긴다', async () => {
    const nagano = sourceConfigSchema.parse({
      poll_collections: { always: ['newitems'] },
      relevance_filter: { include_tags: ['ちいかわ'] },
    });
    const fetcher = fakeFetcher({
      '/sitemap.xml': fixture('chiikawamarket', 'sitemap.xml'),
      sitemap_collections: fixture('chiikawamarket', 'sitemap_collections.xml'),
      '/collections/newitems/products.json': productsPage([
        {
          id: 1,
          handle: 'h',
          title: 'ナガノのくま マスコット',
          tags: ['パグ'],
          vendor: 'v',
          images: [{ src: 'https://cdn.shopify.com/x.jpg' }],
          variants: [{ id: 2, price: '990', available: true }],
        },
      ]),
    });

    const [mention] = await new ShopifyAdapter(fetcher).collect(input({ config: nagano }));

    expect(mention.relevance).toBe('excluded');
    expect(mention.rawPayload).toEqual({ tags: ['パグ'], _collections: ['newitems'] });
    // 제목과 URL은 컬럼에 있다. payload에 중복해서 들고 있을 이유가 없다
    expect(mention.rawTitle).toBe('ナガノのくま マスコット');
    expect(mention.rawPayload).not.toHaveProperty('variants');
    expect(mention.rawPayload).not.toHaveProperty('images');
  });
});
