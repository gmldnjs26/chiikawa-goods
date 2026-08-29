import { Injectable, Logger } from '@nestjs/common';
import robotsParser from 'robots-parser';

import { CollectError } from './http.errors';
import { UA_TOKEN, USER_AGENT } from './user-agent';

interface HostRules {
  /** `null`이면 robots.txt가 없다 = 전부 허용 */
  readonly robot: ReturnType<typeof robotsParser> | null;
}

/**
 * `robots.txt` 취득·해석 (docs/data-collection-design.md §4.1).
 *
 * 매칭 규칙(와일드카드 · `$` · 최장일치)은 직접 짜지 않는다.
 * 틀린 허용은 되돌릴 수 없다 (docs/tech-stack.md §5).
 */
@Injectable()
export class RobotsService {
  private readonly logger = new Logger(RobotsService.name);
  private readonly cache = new Map<string, Promise<HostRules>>();

  /** 호스트당 1회만 받는다. 수집 1회 동안 robots가 바뀔 일은 없다 */
  private rulesFor(url: URL): Promise<HostRules> {
    const origin = url.origin;
    const cached = this.cache.get(origin);
    if (cached) return cached;

    const loading = this.load(origin);
    this.cache.set(origin, loading);
    return loading;
  }

  async isAllowed(url: URL): Promise<boolean> {
    const { robot } = await this.rulesFor(url);
    if (robot === null) return true;

    // undefined = 판정 불가. 허용으로 본다 (robots-parser는 URL이 그룹에
    // 걸리지 않을 때 undefined를 준다 — 규칙 없음은 금지가 아니다)
    return robot.isAllowed(url.href, UA_TOKEN) !== false;
  }

  /** `Crawl-delay` 초. 없으면 `null` — 호출부가 소스 설정값과 max를 잡는다 */
  async crawlDelaySec(url: URL): Promise<number | null> {
    const { robot } = await this.rulesFor(url);
    return robot?.getCrawlDelay(UA_TOKEN) ?? null;
  }

  private async load(origin: string): Promise<HostRules> {
    const robotsUrl = `${origin}/robots.txt`;
    let response: Response;
    try {
      response = await fetch(robotsUrl, { headers: { 'User-Agent': USER_AGENT } });
    } catch (error) {
      // 받아보지 못했으면 막힌 것으로 본다. 모르는 채로 때리지 않는다
      throw new CollectError('network', `robots.txt를 받지 못했다 — ${robotsUrl}: ${String(error)}`);
    }

    if (response.status === 404 || response.status === 410) {
      this.logger.log(`robots.txt 없음 — ${origin}. 전부 허용으로 본다`);
      return { robot: null };
    }

    // 4xx/5xx는 "규칙을 모른다"이지 "허용"이 아니다. 이 실행은 포기한다
    if (!response.ok) {
      throw new CollectError(
        'http',
        `robots.txt 응답이 비정상이다 — ${robotsUrl}: ${response.status}`,
        response.status,
      );
    }

    return { robot: robotsParser(robotsUrl, await response.text()) };
  }
}
