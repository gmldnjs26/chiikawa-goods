import { isAfterObservation } from '@/modules/_common/jst-date';
import type { ItemStatus } from '@/modules/items/entities/item.entity';

import type { ScheduleKind } from '../entities/scheduled-event.entity';

/** 예정 1건의 내용. 셋 중 하나는 있어야 한다 (`CHK_scheduled_event_has_content`) */
export interface ScheduleContent {
  readonly scheduledOn: string | null;
  readonly scheduledText: string | null;
  readonly undecided: boolean;
}

export interface ScheduleSource {
  readonly status: ItemStatus;
  readonly preorderOn: string | null;
  readonly releaseOn: string | null;
  readonly restockDates: readonly string[];
}

/**
 * 태그에서 예정을 만든다 (docs/source-mapping.md §3.5).
 *
 * 「미래」의 기준은 **그 mention의 관측 시각**이다. 지금 시각이 아니다 —
 * 정규화를 다시 돌려도 같은 결과가 나와야 한다. 당일은 미래가 아니다.
 *
 * 본문 파싱(`9月下旬 再入荷予定`)은 v0에서 하지 않는다. 그래서 여기서 나오는 것은 전부
 * `scheduledOn`이다. `scheduledText` · `undecided`는 컬럼은 있되 채우는 코드가 아직 없다.
 */
export function schedulesFromTags(
  source: ScheduleSource,
  observedAt: Date,
): Record<ScheduleKind, ScheduleContent | null> {
  const future = (date: string | null): boolean =>
    date !== null && isAfterObservation(date, observedAt);

  // 예약은 `販売開始前`(UPCOMING)일 때만 예정이다. 판매 중인 상품의 과거 예약 태그는 이력일 뿐이다
  const preorder = source.status === 'UPCOMING' && future(source.preorderOn);
  const release = future(source.releaseOn);
  // 재입고는 누적 태그 중 **가장 가까운 미래** 하나
  const restock = source.restockDates.filter((date) => future(date)).sort()[0] ?? null;

  return {
    preorder: preorder ? dated(source.preorderOn as string) : null,
    release: release ? dated(source.releaseOn as string) : null,
    restock: restock === null ? null : dated(restock),
  };
}

export function sameContent(a: ScheduleContent, b: ScheduleContent): boolean {
  return (
    a.scheduledOn === b.scheduledOn &&
    a.scheduledText === b.scheduledText &&
    a.undecided === b.undecided
  );
}

function dated(date: string): ScheduleContent {
  return { scheduledOn: date, scheduledText: null, undecided: false };
}
