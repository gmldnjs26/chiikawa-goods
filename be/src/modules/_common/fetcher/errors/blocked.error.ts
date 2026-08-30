import { FetchError } from './fetch.error';

/**
 * 차단 신호 (403 / 429 / 챌린지). 이걸 받으면 소스를 스스로 내린다
 * (docs/data-collection-design.md §4.1). **재시도하지 않는다** — 재시도가 차단을 굳힌다.
 */
export class BlockedError extends FetchError {
  constructor(message: string, httpStatus: number | null = null) {
    super('blocked', message, httpStatus);
    this.name = 'BlockedError';
  }

  override get shouldDisableSource(): boolean {
    return true;
  }
}
