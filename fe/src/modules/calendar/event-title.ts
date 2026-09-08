import type { CalendarEvent } from '@/lib/schema';
import { SCHEDULE_KIND_LABELS } from '@/modules/_common/consts';

/**
 * 접힌 사건의 이름 (docs/read-api.md §4.0). 카드의 `drop.title`이 **전부 같고 null이 아닐 때만** 그것 —
 * 컬렉션 제목이다. 아니면 kind 라벨. 섞였는데 하나를 고르면 없는 정보를 만드는 것이다.
 */
export function foldedEventTitle(event: Pick<CalendarEvent, 'kind' | 'items'>): string {
  const titles = new Set(event.items.map((card) => card.drop?.title ?? null));
  const [common] = titles;
  return titles.size === 1 && common !== null && common !== undefined
    ? common
    : SCHEDULE_KIND_LABELS[event.kind];
}
