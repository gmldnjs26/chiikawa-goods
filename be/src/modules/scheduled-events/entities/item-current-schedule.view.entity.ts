import { ViewColumn, ViewEntity } from 'typeorm';

import type { ScheduleKind } from './scheduled-event.entity';

/**
 * 유효한 예정만 (docs/db-schema.md §12.1). 뱃지 = 상태 + 가장 가까운 예정이라 매번 조인이 필요하다.
 *
 * **`DISTINCT ON`을 넣지 않는다.** 유효 행 판정의 권한은 `superseded_at` 하나다.
 * `DISTINCT ON (item_id, kind)`를 함께 쓰면 supersede 로직이 한 건 놓쳤을 때
 * 뷰가 조용히 한 행을 골라 **버그가 안 보인다.** 중복이 나오면 화면에 두 줄로 드러나게 둔다 —
 * `(item_id, kind)` 유효 행 2건 이상이 supersede 버그의 탐지 지점이다 (fe/CLAUDE.md §5).
 *
 * 파일명이 `*.entity.ts`인 이유: DataSource의 entity glob이 그것만 본다 (config/database.config.ts).
 */
@ViewEntity({
  name: 'item_current_schedule',
  expression: `
    SELECT "item_id", "kind", "scheduled_on", "scheduled_text", "undecided", "observed_at"
      FROM "scheduled_event"
     WHERE "superseded_at" IS NULL
  `,
})
export class ItemCurrentSchedule {
  @ViewColumn()
  itemId!: string;

  @ViewColumn()
  kind!: ScheduleKind;

  @ViewColumn()
  scheduledOn!: string | null;

  @ViewColumn()
  scheduledText!: string | null;

  @ViewColumn()
  undecided!: boolean;

  @ViewColumn()
  observedAt!: Date;
}
