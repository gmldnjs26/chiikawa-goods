import { Injectable, Logger } from '@nestjs/common';

import { HostQueue } from './host-queue';
import { BlockedError, CollectError } from './http.errors';
import { RobotsService } from './robots.service';
import { USER_AGENT } from './user-agent';

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

/** robots.txt에 값이 없어도 이 아래로는 내려가지 않는다 */
const MIN_INTERVAL_MS = 1000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 2000;
const TIMEOUT_MS = 20_000;

/**
 * 규범을 지키는 유일한 취득 통로 (docs/data-collection-design.md §4.1).
 *
 * **어댑터는 `fetch`를 직접 부르지 않는다.** 여기를 우회하면 UA·robots·간격이 전부 빠진다.
 * 규범은 코드 품질이 아니라 제품 존속 조건이다 — 한 번 차단당하면 그 소스를 영구히 잃는다.
 */
@Injectable()
export class HttpFetcherService {
  private readonly logger = new Logger(HttpFetcherService.name);
  private readonly queue = new HostQueue();

  constructor(private readonly robots: RobotsService) {}

  async fetchText(rawUrl: string, options: FetchOptions): Promise<FetchedBody> {
    const url = new URL(rawUrl);

    if (!(await this.robots.isAllowed(url))) {
      // 호출 자체를 하지 않는다. 막힌 경로는 시도조차 흔적을 남긴다
      throw new CollectError('blocked', `robots.txt가 막은 경로다 — ${url.href}`);
    }

    const robotsDelaySec = await this.robots.crawlDelaySec(url);
    const intervalMs = Math.max(
      MIN_INTERVAL_MS,
      (robotsDelaySec ?? 0) * 1000,
      options.crawlDelaySec * 1000,
    );

    return this.queue.run(url.host, intervalMs, () => this.attempt(url, intervalMs));
  }

  /** 재시도도 큐 안에서 돈다 — 백오프 중에 다른 요청이 끼어들면 간격이 무너진다 */
  private async attempt(url: URL, intervalMs: number): Promise<FetchedBody> {
    let lastError: CollectError | null = null;

    for (let tries = 1; tries <= MAX_ATTEMPTS; tries += 1) {
      if (tries > 1) await sleep(BACKOFF_BASE_MS * 2 ** (tries - 2) + intervalMs);

      try {
        return await this.once(url);
      } catch (error) {
        // 차단은 재시도하지 않는다. 재시도가 차단을 굳힌다
        if (error instanceof BlockedError) throw error;
        if (!(error instanceof CollectError)) throw error;
        if (error.failureKind !== 'network' && !isRetryableStatus(error.httpStatus)) throw error;

        lastError = error;
        this.logger.warn(`시도 실패 ${tries}/${MAX_ATTEMPTS} — ${url.href}: ${error.message}`);
      }
    }

    throw lastError ?? new CollectError('network', `요청 실패 — ${url.href}`);
  }

  private async once(url: URL): Promise<FetchedBody> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new CollectError('network', `요청 실패 — ${url.href}: ${String(error)}`);
    }

    const body = await response.text();

    if (isBlockSignal(response, body)) {
      throw new BlockedError(`차단 신호 — ${url.href}: ${response.status}`, response.status);
    }
    if (!response.ok) {
      throw new CollectError('http', `HTTP ${response.status} — ${url.href}`, response.status);
    }

    return {
      url: response.url || url.href,
      status: response.status,
      body,
      contentType: response.headers.get('content-type'),
    };
  }
}

/**
 * 403 / 429 / 챌린지 (docs/data-collection-design.md §4.1).
 * Cloudflare 챌린지는 503으로도 온다 — 상태 코드만으로 갈리지 않아 본문도 본다.
 */
function isBlockSignal(response: Response, body: string): boolean {
  if (response.status === 403 || response.status === 429) return true;
  if (response.headers.has('cf-mitigated')) return true;

  const head = body.slice(0, 2000);
  return /cf-browser-verification|challenge-platform|Just a moment\.\.\./i.test(head);
}

function isRetryableStatus(status: number | null): boolean {
  if (status === null) return false;
  return status === 408 || status === 425 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
