import { Injectable, Logger } from '@nestjs/common';

import { CollectError, RobotsDeniedError } from './http.errors';
import { HttpTransportService, MIN_INTERVAL_MS } from './http-transport.service';
import { RobotsService } from './robots.service';

export interface FetchOptions {
  /** `source.crawl_delay_sec`. robots.txt 값과 max를 잡는다 */
  readonly crawlDelaySec: number;
}

export interface FetchedBody {
  readonly url: string;
  readonly status: number;
  readonly body: string;
  readonly contentType: string | null;
}

/** 리다이렉트 체인 상한. 이 이상은 루프로 본다 */
const MAX_REDIRECTS = 5;

/**
 * 규범을 지키는 유일한 취득 통로 (docs/data-collection-design.md §4.1).
 *
 * **어댑터는 `fetch`를 직접 부르지 않는다.** 여기를 우회하면 UA·robots·간격이 전부 빠진다.
 * 규범은 코드 품질이 아니라 제품 존속 조건이다 — 한 번 차단당하면 그 소스를 영구히 잃는다.
 */
@Injectable()
export class HttpFetcherService {
  private readonly logger = new Logger(HttpFetcherService.name);

  constructor(
    private readonly robots: RobotsService,
    private readonly transport: HttpTransportService,
  ) {}

  async fetchText(rawUrl: string, options: FetchOptions): Promise<FetchedBody> {
    let url = new URL(rawUrl);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      // 리다이렉트마다 다시 판정한다. 종착지가 다른 호스트면 그쪽 robots가 적용되고
      // 간격도 그쪽 호스트 기준으로 다시 걸린다. 따라가기만 하면 둘 다 샌다
      const response = await this.requestOnce(url, options);
      if (response.location === null) {
        return {
          url: response.url,
          status: response.status,
          body: response.body,
          contentType: response.contentType,
        };
      }

      const next = new URL(response.location, url);
      this.logger.log(`리다이렉트 — ${url.href} -> ${next.href}`);
      url = next;
    }

    throw new CollectError('http', `리다이렉트가 ${MAX_REDIRECTS}회를 넘었다 — ${rawUrl}`);
  }

  private async requestOnce(url: URL, options: FetchOptions) {
    if (!(await this.robots.isAllowed(url))) {
      // 호출 자체를 하지 않는다. 막힌 경로는 시도조차 흔적을 남긴다
      throw new RobotsDeniedError(`robots.txt가 막은 경로다 — ${url.href}`);
    }

    const robotsDelaySec = await this.robots.crawlDelaySec(url);
    const intervalMs = Math.max(
      MIN_INTERVAL_MS,
      (robotsDelaySec ?? 0) * 1000,
      options.crawlDelaySec * 1000,
    );

    return this.transport.request(url, intervalMs);
  }
}
