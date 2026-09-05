import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ScheduledEvent, ScheduleKind } from './entities/scheduled-event.entity';
import { sameContent, ScheduleContent } from './utils/schedule-from-tags';

export interface ReconcileInput {
  readonly itemId: string;
  readonly kind: ScheduleKind;
  /** 이 관측이 말하는 예정. `null` = 이 kind의 예정이 없다 */
  readonly desired: ScheduleContent | null;
  /** 그 mention의 `observed_at` */
  readonly observedAt: Date;
  readonly mentionId: string;
}

export type ReconcileOutcome = 'stale' | 'unchanged' | 'superseded' | 'created';

/**
 * 예정 (docs/db-schema.md §9). **append-only + `superseded_at`.**
 *
 * 공지는 갱신된다. 덮어쓰면 "언제 무엇이 공지됐는지"가 사라진다 —
 * 새 행을 넣고 이전 행에 `superseded_at`을 찍는다. UPDATE는 그 컬럼 하나뿐이다.
 */
@Injectable()
export class ScheduledEventsService {
  private readonly logger = new Logger(ScheduledEventsService.name);

  constructor(
    @InjectRepository(ScheduledEvent) private readonly rows: Repository<ScheduledEvent>,
  ) {}

  /**
   * 관측 1건을 `(item, kind)`의 예정 이력에 맞춘다 (§9 supersede 규칙).
   *
   * 1. 이 kind에 마지막으로 기록된 시각(`observed_at` 또는 `superseded_at`)보다 오래된 관측은
   *    무시한다 — 재실행이 과거 mention을 다시 볼 때 기록된 이력을 뒤집지 않기 위해서다.
   *    같은 시각도 「이미 봤다」다
   * 2. 예정이 없으면 유효 행을 전부 supersede한다. 지난 날짜는 예정이 아니다
   * 3. 유효 행과 내용이 같으면 아무것도 하지 않는다
   * 4. 다르면 유효 행을 supersede하고 새 행을 넣는다
   *
   * `(item, kind)`의 행은 손에 꼽힌다 — 한 번 읽어 메모리에서 가른다
   */
  async reconcile(input: ReconcileInput): Promise<ReconcileOutcome> {
    const history = await this.rows.find({
      where: { itemId: input.itemId, kind: input.kind },
      order: { observedAt: 'ASC', id: 'ASC' },
    });

    const lastRecorded = Math.max(
      ...history.map((row) => Math.max(row.observedAt.getTime(), row.supersededAt?.getTime() ?? 0)),
    );
    if (history.length > 0 && lastRecorded >= input.observedAt.getTime()) return 'stale';

    const current = history.filter((row) => row.supersededAt === null);

    // 유효 행은 (item, kind)당 1개여야 한다. 2개면 supersede 로직이 샌 것이다 —
    // 뷰가 DISTINCT ON으로 가리지 않으므로 여기서도 소리를 낸다 (§12.1)
    if (current.length > 1) {
      this.logger.warn(
        `item ${input.itemId} ${input.kind}: 유효 예정이 ${current.length}건이다 — supersede 누수`,
      );
    }

    if (input.desired === null) {
      if (current.length === 0) return 'unchanged';
      await this.supersede(current, input.observedAt);
      return 'superseded';
    }

    const desired = input.desired;
    if (current.some((row) => sameContent(row, desired))) return 'unchanged';

    await this.supersede(current, input.observedAt);
    await this.rows.insert({
      itemId: input.itemId,
      kind: input.kind,
      scheduledOn: desired.scheduledOn,
      scheduledText: desired.scheduledText,
      undecided: desired.undecided,
      observedAt: input.observedAt,
      mentionId: input.mentionId,
    });
    return 'created';
  }

  private async supersede(rows: readonly ScheduledEvent[], at: Date): Promise<void> {
    if (rows.length === 0) return;
    await this.rows.update(
      rows.map((row) => row.id),
      { supersededAt: at },
    );
  }
}
