/**
 * JST 달력일 ↔ 시각 변환.
 *
 * 발매일·예약일·재입고일은 전부 **JST 달력일**이다 (docs/db-schema.md §1).
 * `Date`를 로컬 타임존으로 자르면 서버가 어디서 돌든 하루가 밀린다 — 여기서만 변환한다.
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 관측 시각이 JST로 며칠인가. `YYYY-MM-DD` */
export function toJstCalendarDate(at: Date): string {
  return new Date(at.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 태그 날짜의 00:00 JST. 백필 행의 `observed_at`이다 —
 * 날짜만 알고 시각은 모르므로 자정에 둔다 (docs/source-mapping.md §3.4)
 */
export function fromJstMidnight(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}

/** `date`가 관측 시점(JST 달력일)보다 뒤인가. 같은 날은 미래가 아니다 */
export function isAfterObservation(date: string, observedAt: Date): boolean {
  return date > toJstCalendarDate(observedAt);
}
