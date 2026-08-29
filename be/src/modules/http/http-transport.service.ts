import { Injectable, Logger } from '@nestjs/common';

import { exceedsRetryAfter, isBlockSignal, retryAfterMs } from './block-signal';
import { HostQueue } from './host-queue';
import { BlockedError, CollectError } from './http.errors';
import { USER_AGENT } from './user-agent';

export interface RawResponse {
  readonly url: string;
  readonly status: number;
  readonly body: string;
  readonly location: string | null;
  readonly contentType: string | null;
}

/** robots.txt에 값이 없어도 이 아래로는 내려가지 않는다 */
export const MIN_INTERVAL_MS = 1000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 2000;
/** 이 이상 기다리라고 하면 그 실행은 포기한다 */
const RETRY_BUDGET_MS = 6000;
const TIMEOUT_MS = 20_000;

/**
 * 실제로 소켓을 여는 유일한 층 — 큐 · 타임아웃 · 차단 판정 · 백오프.
 *
 * `robots.txt` 취득도 여기를 탄다. robots.txt 자체는 robots 검사 대상이 아니지만
 * **타임아웃과 차단 판정은 예외 없이 필요하다.** 여기를 안 타면 robots.txt에 온
 * 403이 그냥 HTTP 오류가 되고, 소스가 안 내려간 채 다음 실행이 다시 두드린다.
 */
@Injectable()
export class HttpTransportService {
  private readonly logger = new Logger(HttpTransportService.name);
  private readonly queue = new HostQueue();

  request(url: URL, intervalMs: number): Promise<RawResponse> {
    return this.queue.run(url.host, intervalMs, () => this.attempt(url, intervalMs));
  }

  /** 재시도도 큐 안에서 돈다 — 백오프 중에 다른 요청이 끼어들면 간격이 무너진다 */
  private async attempt(url: URL, intervalMs: number): Promise<RawResponse> {
    let lastError: CollectError | null = null;
    /** 상대가 말한 대기 시간. 우리 백오프보다 길면 그쪽을 따른다 */
    let retryAfterMs = 0;

    for (let tries = 1; tries <= MAX_ATTEMPTS; tries += 1) {
      if (tries > 1) {
        await sleep(Math.max(BACKOFF_BASE_MS * 2 ** (tries - 2) + intervalMs, retryAfterMs));
      }

      try {
        return await this.once(url);
      } catch (error) {
        // 차단은 재시도하지 않는다. 재시도가 차단을 굳힌다
        if (error instanceof BlockedError) throw error;
        if (!(error instanceof CollectError)) throw error;
        if (error.failureKind !== 'network' && !isRetryableStatus(error.httpStatus)) throw error;

        lastError = error;
        retryAfterMs = error.retryAfterMs;
        this.logger.warn(`시도 실패 ${tries}/${MAX_ATTEMPTS} — ${url.href}: ${error.message}`);
      }
    }

    throw lastError ?? new CollectError('network', `요청 실패 — ${url.href}`);
  }

  private async once(url: URL): Promise<RawResponse> {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
        // 따라가지 않는다 — 종착지가 다른 호스트면 그쪽 robots와 간격을 새로 적용해야 한다
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new CollectError('network', `요청 실패 — ${url.href}: ${String(error)}`);
    }

    const body = await response.text();

    if (isBlockSignal(response, body)) {
      throw new BlockedError(`차단 신호 — ${url.href}: ${response.status}`, response.status);
    }
    // 상대가 "지금 오지 마라"라고 했다. 기다렸다 때리지 않는다
    if (exceedsRetryAfter(response, RETRY_BUDGET_MS)) {
      throw new BlockedError(`Retry-After가 길다 — ${url.href}`, response.status);
    }

    const location = response.headers.get('location');
    if (isRedirect(response.status) && location !== null) {
      return { url: url.href, status: response.status, body, location, contentType: null };
    }
    if (!response.ok) {
      const error = new CollectError(
        'http',
        `HTTP ${response.status} — ${url.href}`,
        response.status,
      );
      // 예산 안이라 포기하진 않지만, 그렇다고 그보다 먼저 가지도 않는다
      error.retryAfterMs = retryAfterMs(response);
      throw error;
    }

    return {
      url: url.href,
      status: response.status,
      body,
      location: null,
      contentType: response.headers.get('content-type'),
    };
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isRetryableStatus(status: number | null): boolean {
  if (status === null) return false;
  return status === 408 || status === 425 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
