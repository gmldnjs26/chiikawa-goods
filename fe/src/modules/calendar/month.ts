/**
 * 캘린더의 달 단위 이동. URL은 `?month=YYYY-MM`, API는 `from` · `to` (docs/read-api.md §4).
 * 날짜는 문자열로만 다룬다 — 실행 환경 시간대를 끼우지 않는다.
 */

const MONTH_RE = /^(\d{4})-(\d{2})$/;

/** `YYYY-MM`이 아니면 null. 조용히 기본값으로 돌리지 않고 호출자가 정한다 */
export function parseMonth(value: string | undefined): string | null {
  if (value === undefined) return null;
  const match = MONTH_RE.exec(value);
  if (match === null) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? value : null;
}

/** `2026-09-15` → `2026-09` */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** `2026-09` → `{ from: '2026-09-01', to: '2026-09-30' }` */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

/** `2026-12` + 1 → `2027-01` */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** `2026-09` → `2026年9月` */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}年${m}月`;
}
