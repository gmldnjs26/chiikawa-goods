import type { CalendarEvent, Card } from '../dto/card.dto';
import { compareId } from './ordering';

/** 접기 전의 사건 — 카드 1건 */
export interface RawEvent {
  readonly date: string;
  readonly kind: CalendarEvent['kind'];
  readonly card: Card;
}

/**
 * 사건을 발표 단위로 접는다 (docs/read-api.md §4.0).
 *
 * 키는 **날짜 + kind + 채널 + 브랜드**다. `Card.drop`이 아니다 — 재입고는 발표가 아니라 전이라서
 * 같은 날 재입고된 굿즈들의 `drop`(처음 나온 발표)이 제각각이다. 이 식은 `drop_group` 2순위
 * (docs/db-schema.md §6)를 사건에 적용한 것이고, 예약 · 발매 사건에서는 `drop`과 일치한다.
 *
 * **브랜드 미판정은 접지 않는다.** 미판정끼리 날짜만으로 묶으면 관계없는 굿즈가 한 발표가 된다.
 */
export function foldEvents(raw: readonly RawEvent[]): CalendarEvent[] {
  const buckets = new Map<string, CalendarEvent>();

  for (const event of raw) {
    const brand = event.card.brand;
    const key =
      brand === null
        ? `${event.date}:${event.kind}:item:${event.card.id}`
        : `${event.date}:${event.kind}:${event.card.channel}:${brand.code}`;

    const bucket = buckets.get(key);
    if (bucket !== undefined) {
      (bucket.items as Card[]).push(event.card);
      continue;
    }
    buckets.set(key, { date: event.date, kind: event.kind, brand, items: [event.card] });
  }

  for (const event of buckets.values()) (event.items as Card[]).sort(compareCards);
  return [...buckets.values()];
}

/** 사건 안의 카드 순서: title → id */
function compareCards(a: Card, b: Card): number {
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  return compareId(a.id, b.id);
}
