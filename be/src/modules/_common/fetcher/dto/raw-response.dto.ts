/**
 * 전송 층의 출력. 리다이렉트를 따라가지 않으므로 `location`이 남아 있을 수 있다 —
 * 종착지 판정(robots · 호스트 간격)은 상위 층이 한다.
 */
export interface RawResponse {
  readonly url: string;
  readonly status: number;
  readonly body: string;
  readonly location: string | null;
  readonly contentType: string | null;
}
