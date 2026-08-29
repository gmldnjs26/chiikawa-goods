import { Injectable, Logger } from '@nestjs/common';
import robotsParser from 'robots-parser';

import { CollectError } from './http.errors';
import { HttpTransportService, MIN_INTERVAL_MS } from './http-transport.service';
import { UA_TOKEN } from './user-agent';

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

  constructor(private readonly transport: HttpTransportService) {}

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

  /**
   * robots.txt 자체는 robots 검사 대상이 아니지만 **전송 층은 그대로 탄다** —
   * 여기 온 403/챌린지도 차단이고, 타임아웃도 필요하다.
   */
  private async load(origin: string): Promise<HostRules> {
    const robotsUrl = new URL('/robots.txt', origin);

    // 404를 흡수해야 하므로 `http` 실패만 여기서 가른다. 차단은 그대로 던진다
    let body: string;
    try {
      const response = await this.transport.request(robotsUrl, MIN_INTERVAL_MS);
      if (response.location !== null) {
        // robots.txt가 리다이렉트되면 종착지를 따라가지 않는다. 규칙을 모르는 상태다
        throw new CollectError('http', `robots.txt가 리다이렉트된다 — ${robotsUrl.href}`);
      }
      body = response.body;
    } catch (error) {
      if (error instanceof CollectError && isMissing(error)) {
        this.logger.log(`robots.txt 없음 — ${origin}. 전부 허용으로 본다`);
        return { robot: null };
      }
      // 4xx/5xx는 "규칙을 모른다"이지 "허용"이 아니다. 이 실행은 포기한다
      throw error;
    }

    return { robot: robotsParser(robotsUrl.href, body) };
  }
}

function isMissing(error: CollectError): boolean {
  return error.httpStatus === 404 || error.httpStatus === 410;
}
