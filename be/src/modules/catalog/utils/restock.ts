import { toJstCalendarDate } from '@/modules/_common/jst-date';
import type { ItemStatus } from '@/modules/items/entities/item.entity';

/** `status_history` 행 중 판정에 필요한 것만 */
export interface HistoryRow {
  readonly status: ItemStatus;
  readonly observedAt: Date;
  readonly isBackfilled: boolean;
}

export interface RestockSummary {
  /** 가장 최근 재입고 시각. 없으면 null */
  readonly restockedAt: Date | null;
  /** 재입고가 있었던 JST 달력일. 오름차순, 중복 없음 */
  readonly dates: readonly string[];
}

/**
 * 이력에서 재입고를 읽는다 (docs/read-api.md §2.1 `restockedAt` · §4.1 과거 `restock`).
 *
 * 재입고는 상태가 아니라 **`ENDED → ON_SALE` 전이**다. 두 가지가 재입고다.
 * - 실시간 관측: `ON_SALE` 행의 직전 행이 `ENDED`
 * - 백필 행: 재입고 태그에서 소급한 `ON_SALE` (docs/source-mapping.md §3.4). 그 자체가 재입고 사실이다
 *
 * `rows`는 `observedAt` 오름차순이어야 한다.
 */
export function summarizeRestocks(rows: readonly HistoryRow[]): RestockSummary {
  const dates = new Set<string>();
  let latest: Date | null = null;

  rows.forEach((row, index) => {
    const previous = index > 0 ? rows[index - 1] : undefined;
    const isRestock =
      row.status === 'ON_SALE' && (row.isBackfilled || previous?.status === 'ENDED');
    if (!isRestock) return;

    dates.add(toJstCalendarDate(row.observedAt));
    if (latest === null || row.observedAt.getTime() > latest.getTime()) latest = row.observedAt;
  });

  return { restockedAt: latest, dates: [...dates].sort() };
}
