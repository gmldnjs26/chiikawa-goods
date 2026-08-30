/**
 * 차단 신호 판정 (docs/data-collection-design.md §4.1).
 *
 * 상태 코드만으로 갈리지 않는다 — Cloudflare 인터스티셜은 200으로도 503으로도 온다.
 * **본문 전체를 본다.** 앞부분만 보면 마커가 뒤에 있는 페이지를 5xx로 오인하고,
 * 그러면 재시도 대상이 되어 챌린지에 연타한다.
 */
const CHALLENGE_MARKERS =
  /cf-browser-verification|challenge-platform|cf_chl_|__cf_chl|Just a moment|Checking your browser|Attention Required|DDoS protection by/i;

export function isBlockSignal(response: Response, body: string): boolean {
  if (response.status === 403 || response.status === 429) return true;
  if (response.headers.has('cf-mitigated')) return true;

  // 챌린지는 **HTML 인터스티셜**로 온다. 정상 JSON/XML 응답 본문까지 훑으면
  // `Just a moment` 같은 평범한 문자열에 오탐하고, 그 대가가 `enabled=false` 영구 정지다.
  // 「한 번 차단당하면 소스를 잃는다」를 우리 손으로 실행하게 된다
  if (!looksLikeHtml(response, body)) return false;

  // 여기부터는 본문 **전체**를 본다. 앞부분만 보면 마커가 뒤에 있는 챌린지를
  // 5xx로 오인하고, 그러면 재시도 대상이 되어 챌린지에 연타한다
  return CHALLENGE_MARKERS.test(body);
}

function looksLikeHtml(response: Response, body: string): boolean {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) return true;

  // Content-Type도 거짓말한다 (§7). 선두 바이트로도 본다
  return /^\s*(<!doctype html|<html)/i.test(body.slice(0, 200));
}

/** `Retry-After` 밀리초. 없거나 못 읽으면 0 */
export function retryAfterMs(response: Response): number {
  const header = response.headers.get('retry-after');
  if (header === null) return 0;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(header);
  return Number.isNaN(date) ? 0 : Math.max(0, date - Date.now());
}

/**
 * `Retry-After`가 붙어 있으면 상대가 "지금 오지 마라"라고 말한 것이다.
 * 우리 백오프(최대 6초)보다 길게 요구하면 그 실행은 포기한다 — 기다렸다 때리지 않는다.
 */
export function exceedsRetryAfter(response: Response, budgetMs: number): boolean {
  const header = response.headers.get('retry-after');
  if (header === null) return false;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000 > budgetMs;

  const date = Date.parse(header);
  return Number.isNaN(date) ? true : date - Date.now() > budgetMs;
}
