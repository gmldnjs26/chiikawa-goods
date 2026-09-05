import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { fromJstMidnight, isAfterObservation } from '@/modules/_common/jst-date';
import type { ItemStatus } from '@/modules/items/entities/item.entity';

import { StatusHistory } from './entities/status-history.entity';

export interface TransitionInput {
  readonly itemId: string;
  readonly status: ItemStatus;
  /** 그 mention의 `observed_at`. 정규화를 돌린 시각이 아니다 */
  readonly observedAt: Date;
  readonly mentionId: string;
}

export interface BackfillInput {
  readonly itemId: string;
  /** `RE20231221` 같은 태그에서 나온 JST 달력일 전부 */
  readonly restockDates: readonly string[];
  readonly observedAt: Date;
  readonly mentionId: string;
}

/**
 * 상태 전이 이력 (docs/db-schema.md §8). **append-only** — UPDATE도 DELETE도 없다.
 *
 * 이 에픽은 소급 불가다. 관측하지 않은 전이는 나중에 만들 수 없다.
 * 알림이 아직 없어도 이력은 쌓는다 — 알림 빈도를 실측으로 정할 유일한 근거다.
 */
@Injectable()
export class StatusHistoriesService {
  constructor(@InjectRepository(StatusHistory) private readonly rows: Repository<StatusHistory>) {}

  /**
   * 전이 1행. 같은 mention이 같은 item에 두 번 넣지 않는다 (`UQ_status_history_observation`).
   * 재실행은 무시된다 — 이미 있는 행을 고치지 않는다.
   *
   * @returns 실제로 행이 들어갔는가
   */
  async record(input: TransitionInput): Promise<boolean> {
    const result = await this.rows
      .createQueryBuilder()
      .insert()
      .values({
        itemId: input.itemId,
        status: input.status,
        observedAt: input.observedAt,
        mentionId: input.mentionId,
        isBackfilled: false,
      })
      .orIgnore()
      .execute();
    return result.identifiers.length > 0;
  }

  /** 실시간 관측 행이 하나라도 있는가. 백필 행은 세지 않는다 — `item.status`는 최신 **관측** 행의 사본이다 */
  async hasAny(itemId: string): Promise<boolean> {
    return this.rows.exists({ where: { itemId, isBackfilled: false } });
  }

  /**
   * 재입고 태그 백필 (docs/source-mapping.md §3.4). 과거 재입고 날짜마다 `ON_SALE` 1행,
   * `observed_at`은 그 날 00:00 JST, `is_backfilled=true`.
   *
   * **관측일보다 뒤인 날짜는 넣지 않는다** — 그건 과거가 아니라 예정이다 (§3.5).
   * 관측일 당일은 백필한다. 태그가 붙었다는 건 그 날 재입고가 있었다는 뜻이다.
   *
   * @returns 실제로 들어간 행 수
   */
  async backfill(input: BackfillInput): Promise<number> {
    const past = input.restockDates.filter((date) => !isAfterObservation(date, input.observedAt));
    if (past.length === 0) return 0;

    const result = await this.rows
      .createQueryBuilder()
      .insert()
      .values(
        past.map((date) => ({
          itemId: input.itemId,
          status: 'ON_SALE' as const,
          observedAt: fromJstMidnight(date),
          mentionId: input.mentionId,
          isBackfilled: true,
        })),
      )
      .orIgnore()
      .execute();
    return result.identifiers.length;
  }
}
