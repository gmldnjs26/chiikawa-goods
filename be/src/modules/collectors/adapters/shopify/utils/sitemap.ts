import { XMLParser } from 'fast-xml-parser';

import { assertXmlBody } from '@/modules/_common/fetcher/utils/body-validation';

const parser = new XMLParser({ ignoreAttributes: false });

/**
 * sitemap 인덱스에서 컬렉션 sitemap URL을 고른다 (docs/source-mapping.md §1).
 *
 * 자식 URL을 **하드코딩하지 않는다** — 실제 URL에 `?from=&to=`가 붙어 있고
 * 값은 스토어마다 다르고 변한다. 인덱스가 준 것을 그대로 쓴다.
 *
 * 로케일 사본(`/ko/sitemap_collections_1.xml`)을 걸러낸다.
 * 문자열 포함으로 고르면 같은 상품을 언어 수만큼 본다.
 */
export function pickCollectionSitemaps(indexUrl: string, body: string): string[] {
  assertXmlBody(indexUrl, body);
  const entries = toArray<{ loc?: string }>(
    (parser.parse(body) as SitemapIndex).sitemapindex?.sitemap,
  );

  return entries
    .map((entry) => entry.loc)
    .filter((loc): loc is string => typeof loc === 'string')
    .filter((loc) => new URL(loc).pathname.startsWith('/sitemap_collections'));
}

/** 컬렉션 sitemap에서 핸들만 뽑는다 */
export function extractCollectionHandles(sitemapUrl: string, body: string): string[] {
  assertXmlBody(sitemapUrl, body);
  const entries = toArray<{ loc?: string }>((parser.parse(body) as UrlSet).urlset?.url);

  const handles = entries
    .map((entry) => entry.loc)
    .filter((loc): loc is string => typeof loc === 'string')
    .map((loc) => new URL(loc).pathname)
    .filter((path) => path.includes('/collections/'))
    .map((path) => path.split('/collections/')[1])
    .filter((handle) => handle.length > 0 && !handle.includes('/'));

  return [...new Set(handles)];
}

interface SitemapIndex {
  sitemapindex?: { sitemap?: unknown };
}
interface UrlSet {
  urlset?: { url?: unknown };
}

function toArray<T>(value: unknown): T[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]) as T[];
}
