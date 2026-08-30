import type { FetchErrorKind } from './fetch-error-kind';

/**
 * 요청 실패의 기본형. 종류를 예외에 실어 보내면 호출부가 메시지 문자열을 재판정하지 않는다.
 */
export class FetchError extends Error {
  constructor(
    readonly kind: FetchErrorKind,
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = 'FetchError';
  }

  /** 상대가 `Retry-After`로 말한 대기 시간. 우리 백오프의 하한이 된다 */
  retryAfterMs = 0;

  /** 소스를 통째로 내려야 하는 사건인가. 기본은 아니다 */
  get shouldDisableSource(): boolean {
    return false;
  }
}
