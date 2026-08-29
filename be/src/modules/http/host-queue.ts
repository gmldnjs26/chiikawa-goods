/**
 * 호스트 단위 직렬화 + 최소 간격 (docs/data-collection-design.md §4.1).
 *
 * **동시 요청 1이 규범이다.** 병렬 이득보다 차단 위험이 크다 —
 * 한 번 막히면 그 소스를 영구히 잃는다.
 *
 * 프로세스 안에서만 성립한다. 실행이 겹치는 문제는 여기서 못 막는다
 * (§6.2 `pg_advisory_lock`이 그 층이다).
 */
export class HostQueue {
  /** 호스트별 꼬리. 앞 작업이 끝나야 다음이 시작한다 */
  private readonly tails = new Map<string, Promise<unknown>>();
  private readonly lastFinishedAt = new Map<string, number>();

  constructor(private readonly sleep: (ms: number) => Promise<void> = defaultSleep) {}

  /** 같은 호스트면 앞 작업 종료 + `minIntervalMs` 경과 후에 실행한다 */
  run<T>(host: string, minIntervalMs: number, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(host) ?? Promise.resolve();

    // 앞 작업이 실패해도 줄은 이어져야 한다. catch로 끊고 다음을 태운다
    const result = previous.catch(() => undefined).then(async () => {
      await this.waitInterval(host, minIntervalMs);
      try {
        return await task();
      } finally {
        this.lastFinishedAt.set(host, Date.now());
      }
    });

    this.tails.set(
      host,
      result.catch(() => undefined),
    );
    return result;
  }

  private async waitInterval(host: string, minIntervalMs: number): Promise<void> {
    if (minIntervalMs <= 0) return;
    const last = this.lastFinishedAt.get(host);
    if (last === undefined) return;

    const remaining = minIntervalMs - (Date.now() - last);
    if (remaining > 0) await this.sleep(remaining);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
