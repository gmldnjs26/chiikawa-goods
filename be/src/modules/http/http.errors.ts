import type { FailureKind } from '@/modules/collection-runs/entities/collection-run.entity';

/**
 * 수집 실패는 `collection_run.failure_kind`로 그대로 기록된다.
 * 예외에 종류를 실어 보내면 호출부가 문자열을 재판정하지 않는다.
 */
export class CollectError extends Error {
  constructor(
    readonly failureKind: FailureKind,
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = 'CollectError';
  }

  /** 상대가 `Retry-After`로 말한 대기 시간. 우리 백오프의 하한이 된다 */
  retryAfterMs = 0;

  /** 소스를 통째로 내려야 하는 사건인가. 기본은 아니다 */
  get shouldDisableSource(): boolean {
    return false;
  }
}

/**
 * 차단 신호 (403 / 429 / 챌린지). 이걸 받으면 소스를 스스로 내린다
 * (docs/data-collection-design.md §4.1). **재시도하지 않는다** — 재시도가 차단을 굳힌다.
 */
export class BlockedError extends CollectError {
  constructor(message: string, httpStatus: number | null = null) {
    super('blocked', message, httpStatus);
    this.name = 'BlockedError';
  }

  override get shouldDisableSource(): boolean {
    return true;
  }
}

/**
 * `robots.txt`가 막은 경로. **차단과 다른 사건이다** —
 * 상대가 우리를 막은 게 아니라 우리가 가면 안 되는 곳을 가리킨 것이다.
 * 소스를 내리지 않는다. 고칠 곳은 `config`이지 상대가 아니다.
 */
export class RobotsDeniedError extends CollectError {
  constructor(message: string) {
    super('blocked', message);
    this.name = 'RobotsDeniedError';
  }
}
