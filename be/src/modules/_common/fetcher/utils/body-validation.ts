import { FetchError } from '../errors/fetch.error';

/**
 * 본문 검증 (docs/data-collection-design.md §7).
 *
 * **상태 코드를 신뢰하지 않는다.** 관측된 사례 —
 * `Content-Type: application/xml`인데 본문이 HTML, 404인데 `application/xml`,
 * 없는 경로에 200 + 공통 SPA.
 *
 * 검증 실패는 파싱 성공이 아니라 **수집 실패**다 (`failure_kind='validation'`).
 */

/** BOM·공백을 걷어낸 선두. 스니핑은 여기서 한다 */
function leading(body: string): string {
  return body.replace(/^\uFEFF/, '').trimStart();
}

/** 기대 키까지 확인한다. `{`로 시작하는 에러 JSON도 형식은 JSON이다 */
export function parseJsonBody<T = unknown>(url: string, body: string, expectedKeys: string[]): T {
  const head = leading(body);
  if (!head.startsWith('{') && !head.startsWith('[')) {
    throw new FetchError('validation', `JSON이 아니다 — ${url}: 선두 ${snippet(head)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(head);
  } catch (error) {
    throw new FetchError('validation', `JSON 파싱 실패 — ${url}: ${String(error)}`);
  }

  if (expectedKeys.length > 0) {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new FetchError('validation', `객체가 아니다 — ${url}`);
    }
    const missing = expectedKeys.filter((key) => !(key in parsed));
    if (missing.length > 0) {
      throw new FetchError('validation', `기대 키가 없다 — ${url}: ${missing.join(', ')}`);
    }
  }

  return parsed as T;
}

/** 선두 바이트 스니핑. `Content-Type`은 보지 않는다 — 거짓말하는 사례를 실제로 봤다 */
export function assertXmlBody(url: string, body: string): string {
  const head = leading(body);
  if (!/^<\?xml|^<rss|^<feed|^<urlset|^<sitemapindex/i.test(head)) {
    throw new FetchError('validation', `XML이 아니다 — ${url}: 선두 ${snippet(head)}`);
  }
  return head;
}

function snippet(body: string): string {
  return JSON.stringify(body.slice(0, 60));
}
