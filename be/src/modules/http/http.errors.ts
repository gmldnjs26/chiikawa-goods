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
}
