/**
 * 표기 순수함수 (fe/CLAUDE.md §5). 일본 관례 — `¥2,970` · `8/25(月)` · `全8種`.
 *
 * 날짜는 JST 달력일 `YYYY-MM-DD` 문자열이다. `Date`로 바꾸면 실행 환경의 시간대가 끼어드니
 * 문자열을 직접 자른다. 요일만 UTC 달력으로 구한다 (달력일이 같으면 요일도 같다).
 */

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;

function splitDate(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

/** `2026-08-25` → `8/25` */
export function formatMonthDay(date: string): string {
  const [, m, d] = splitDate(date);
  return `${m}/${d}`;
}

/** `2026-08-25` → `月` */
export function formatWeekday(date: string): string {
  const [y, m, d] = splitDate(date);
  return WEEKDAYS_JA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** `2026-08-25` → `8/25(月)` */
export function formatDate(date: string): string {
  return `${formatMonthDay(date)}(${formatWeekday(date)})`;
}

/** 달력일 `b − a`. 같은 날이면 0, 미래면 양수 */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = splitDate(a);
  const [by, bm, bd] = splitDate(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** 남은 일수 표기. 당일 이하는 `本日`, 미래는 `D-3` */
export function formatCountdown(days: number): string {
  return days <= 0 ? '本日' : `D-${days}`;
}

/**
 * `¥2,970`. variant 간 가격이 다르면 최저가에 `〜`.
 * null이면 null — 표기할 것이 없다. 「価格未定」같은 값을 만들지 않는다.
 */
export function formatPrice(price: number | null, varies = false): string | null {
  if (price === null) return null;
  return `¥${price.toLocaleString('ja-JP')}${varies ? '〜' : ''}`;
}

/** `全8種`. random인데 총수가 없으면 `ランダム`만 */
export function formatSeriesTotal(total: number | null): string {
  return total === null ? 'ランダム' : `全${total}種`;
}

/**
 * 예정 1건의 시기 표기. `date` / `text` / `undecided` 3상태 (docs/read-api.md §2.2).
 * `9月下旬`은 **원문 그대로** 낸다. 날짜로 바꾸지 않는다.
 * 셋 다 비어 있으면 null — 서버 제약(`CHK_scheduled_event_has_content`)상 오지 않지만 여기서 만들어내지 않는다.
 */
export function formatScheduleWhen(schedule: {
  date: string | null;
  text: string | null;
  undecided: boolean;
}): string | null {
  if (schedule.date !== null) return formatMonthDay(schedule.date);
  if (schedule.text !== null) return schedule.text;
  if (schedule.undecided) return '未定';
  return null;
}

/** ISO 시각 → JST `9/4 21:01`. 출처의 「확인 시각」에 쓴다 */
export function formatDateTimeJst(iso: string): string {
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')}`;
}

/** ISO 시각 → JST 달력일 `YYYY-MM-DD`. 📦 폭 판정에 쓴다 */
export function toJstCalendarDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
