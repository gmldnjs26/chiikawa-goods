import { CHANNELS } from '@/modules/items/entities/item.entity';

import type { CalendarEvent, Card } from '../dto/card.dto';

/**
 * 홈 · 캘린더의 정렬 (docs/read-api.md §3.1 · §4). 순수 함수 — SQL로 하지 않는 이유는
 * 예정이 카드에 이미 실려 있고, 홈은 20건 규모라 메모리 정렬이 더 단순하기 때문이다.
 */

/** 🔜 もうすぐ의 기준일. `preorder` · `release` 유효 예정 중 가장 가까운 날짜 */
export function nearestOpeningDate(card: Card): string | null {
  const dates = card.schedules
    .filter((schedule) => schedule.kind !== 'restock' && schedule.date !== null)
    .map((schedule) => schedule.date as string)
    .sort();
  return dates[0] ?? null;
}

/** 🔵 再入荷を待てるもの의 기준일. 날짜가 없는(`text`만) 예정은 뒤로 간다 */
export function nearestRestockDate(card: Card): string | null {
  const dates = card.schedules
    .filter((schedule) => schedule.kind === 'restock' && !schedule.undecided)
    .map((schedule) => schedule.date)
    .filter((date): date is string => date !== null)
    .sort();
  return dates[0] ?? null;
}

/** 날짜 오름차순. null은 맨 뒤. 같으면 id로 고정 — 응답이 요청마다 흔들리지 않게 */
export function byDateThenId(dateOf: (card: Card) => string | null): (a: Card, b: Card) => number {
  return (a, b) => {
    const da = dateOf(a);
    const db = dateOf(b);
    if (da !== db) {
      if (da === null) return 1;
      if (db === null) return -1;
      return da < db ? -1 : 1;
    }
    return compareId(a.id, b.id);
  };
}

/**
 * 캘린더: date → channel(선언 순서) → 접힌 사건 먼저 → 첫 카드 title → id.
 * 「51点」 한 줄이 개별 행들 사이에 묻히지 않게 접힌 것을 앞에 둔다 (docs/read-api.md §4)
 */
export function compareEvents(a: CalendarEvent, b: CalendarEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const [ia, ib] = [a.items[0], b.items[0]];
  const ca = CHANNELS.indexOf(ia.channel);
  const cb = CHANNELS.indexOf(ib.channel);
  if (ca !== cb) return ca - cb;
  const [fa, fb] = [a.items.length > 1 ? 0 : 1, b.items.length > 1 ? 0 : 1];
  if (fa !== fb) return fa - fb;
  if (ia.title !== ib.title) return ia.title < ib.title ? -1 : 1;
  return compareId(ia.id, ib.id);
}

/** bigint 문자열. 자릿수 → 사전순 */
export function compareId(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  return a < b ? -1 : a > b ? 1 : 0;
}
