import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';

import { addDays, fromJstMidnight, toJstCalendarDate } from '@/modules/_common/jst-date';
import { Item } from '@/modules/items/entities/item.entity';

import { AssembledCard, CardAssemblerService } from './card-assembler.service';
import type { ArchiveResponse, CalendarResponse, Card, HomeResponse } from './dto/card.dto';
import { ArchiveCursor, encodeCursor } from './utils/cursor';
import { foldEvents, RawEvent } from './utils/fold-events';
import {
  byDateThenId,
  compareEvents,
  nearestOpeningDate,
  nearestRestockDate,
} from './utils/ordering';

/** 🔜 もうすぐ = 8일 전 ~ 당일 (docs/plan.md §6.2) */
const UPCOMING_WINDOW_DAYS = 8;

/**
 * 게시 게이트 (docs/read-api.md §6). 모든 질의에 붙는다.
 * `item`에 `source_id`가 없으므로 `item_mention → mention → source`로 판정한다.
 * 연결 소스 **전부**가 허가여야 하고, 연결이 없는 item은 근거가 없으니 내지 않는다.
 */
const PUBLISHED = `
  NOT EXISTS (
    SELECT 1 FROM item_mention gate_link
      JOIN mention gate_mention ON gate_mention.id = gate_link.mention_id
      JOIN source gate_source ON gate_source.id = gate_mention.source_id
     WHERE gate_link.item_id = item.id AND gate_source.publish_allowed_at IS NULL)
  AND EXISTS (SELECT 1 FROM item_mention any_link WHERE any_link.item_id = item.id)`;

/** 아카이브 keyset의 정렬 키. 이유는 `archive()` 주석 */
const STATUS_AT_MS = `date_trunc('milliseconds', item.status_at)`;

/** 🔵의 조건이자 아카이브의 제외 조건 — 유효한 재입고 예정, 미정 제외 (§3.1 · §5.1) */
const HAS_WAITABLE_RESTOCK = `
  EXISTS (
    SELECT 1 FROM item_current_schedule restock
     WHERE restock.item_id = item.id AND restock.kind = 'restock' AND restock.undecided = false)`;

/*
 * 유효 예정은 전부 `item_current_schedule` 뷰로 본다. `superseded_at IS NULL`을 여기 다시 쓰면
 * 「유효 행 판정의 권한은 하나」(docs/db-schema.md §12.1)가 두 곳에 복제된다.
 */

/**
 * 화면 단위 읽기 모델 (docs/read-api.md). **읽기만 한다.**
 * 섹션 소속은 여기서 정하고, 뱃지 판정은 화면이 한다 — 상태와 예정을 가공 없이 넘긴다.
 */
@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    private readonly assembler: CardAssemblerService,
  ) {}

  /** §3 홈 3섹션. 섹션은 서로 배타다 */
  async home(now: Date): Promise<HomeResponse> {
    const today = toJstCalendarDate(now);
    const horizon = addDays(today, UPCOMING_WINDOW_DAYS);

    const [onSale, upcoming, waitable] = await Promise.all([
      this.visible()
        .andWhere(`item.status = 'ON_SALE'`)
        .orderBy('item.status_at', 'DESC')
        .getMany(),
      this.visible()
        .andWhere(`item.status = 'UPCOMING'`)
        .andWhere(
          `EXISTS (
            SELECT 1 FROM item_current_schedule opening
             WHERE opening.item_id = item.id AND opening.kind IN ('preorder', 'release')
               AND opening.scheduled_on <= :horizon)`,
          { horizon },
        )
        .getMany(),
      this.visible().andWhere(`item.status = 'ENDED'`).andWhere(HAS_WAITABLE_RESTOCK).getMany(),
    ]);

    // 섹션은 배타라 합쳐서 한 번 조립해도 카드가 겹치지 않는다. 조인 4개 × 3 대신 4개
    const cards = await this.cards([...onSale, ...upcoming, ...waitable]);
    const pick = (items: readonly Item[]): Card[] => {
      const ids = new Set(items.map((item) => item.id));
      return cards.filter((card) => ids.has(card.id));
    };

    return {
      generatedAt: now.toISOString(),
      today,
      onSale: pick(onSale),
      upcoming: pick(upcoming).sort(byDateThenId(nearestOpeningDate)),
      waitable: pick(waitable).sort(byDateThenId(nearestRestockDate)),
    };
  }

  /** §4 사건. 굿즈가 아니다 — 같은 카드가 예약일과 발매일에 두 번 실린다 */
  async calendar(now: Date, from: string, to: string): Promise<CalendarResponse> {
    const rangeStart = fromJstMidnight(from);
    const rangeEnd = fromJstMidnight(addDays(to, 1));

    // 범위에 사건이 있을 수 있는 item만. 과거 재입고는 이력 순서가 있어야 판정되므로
    // 여기서는 ON_SALE 이력이 범위에 있는 item을 넉넉히 뽑고 조립 후에 거른다
    const items = await this.visible()
      .andWhere(
        new Brackets((qb) => {
          qb.where('item.preorder_on BETWEEN :from AND :to', { from, to })
            .orWhere('item.release_on BETWEEN :from AND :to', { from, to })
            .orWhere(
              `EXISTS (
                SELECT 1 FROM item_current_schedule planned
                 WHERE planned.item_id = item.id AND planned.kind = 'restock'
                   AND planned.scheduled_on BETWEEN :from AND :to)`,
              { from, to },
            )
            .orWhere(
              `EXISTS (
                SELECT 1 FROM status_history restocked
                 WHERE restocked.item_id = item.id AND restocked.status = 'ON_SALE'
                   AND restocked.observed_at >= :rangeStart AND restocked.observed_at < :rangeEnd)`,
              { rangeStart, rangeEnd },
            );
        }),
      )
      .getMany();

    const assembled = await this.assembler.assemble(items);
    const inRange = (date: string | null): date is string =>
      date !== null && date >= from && date <= to;

    const raw: RawEvent[] = [];
    for (const { card, restockDates } of assembled) {
      if (inRange(card.preorderOn)) raw.push({ date: card.preorderOn, kind: 'preorder', card });
      if (inRange(card.releaseOn)) raw.push({ date: card.releaseOn, kind: 'release', card });

      // 재입고: 예고(유효 예정, 날짜 있는 것)와 실제(이력). 같은 날이면 한 번
      const restockDays = new Set<string>();
      for (const schedule of card.schedules) {
        if (schedule.kind === 'restock' && inRange(schedule.date)) restockDays.add(schedule.date);
      }
      for (const date of restockDates) if (inRange(date)) restockDays.add(date);
      for (const date of restockDays) raw.push({ date, kind: 'restock', card });
    }

    // 발표 단위로 접는다 (§4.0). 「9/18 発売 51点」이 1행이다
    return {
      generatedAt: now.toISOString(),
      today: toJstCalendarDate(now),
      from,
      to,
      events: foldEvents(raw).sort(compareEvents),
    };
  }

  /**
   * §5 過去 / 完売. keyset 페이지네이션.
   *
   * 정렬과 비교 둘 다 **밀리초로 자른** `status_at`을 쓴다. 커서는 JS `Date`(ms)를 실어 나르는데
   * `timestamptz`는 마이크로초다 — 자르지 않으면 같은 ms 안의 행이 다음 페이지에서 빠진다.
   * 정렬만 자르지 않으면 순서가 어긋나 같은 문제가 난다. 둘을 같이 자른다
   */
  async archive(now: Date, limit: number, cursor: ArchiveCursor | null): Promise<ArchiveResponse> {
    const query = this.visible()
      .andWhere(`item.status = 'ENDED'`)
      .andWhere(`NOT ${HAS_WAITABLE_RESTOCK}`)
      .orderBy(STATUS_AT_MS, 'DESC')
      .addOrderBy('item.id', 'DESC')
      .take(limit + 1);

    if (cursor !== null) {
      query.andWhere(`(${STATUS_AT_MS}, item.id) < (:statusAt, :id)`, {
        statusAt: cursor.statusAt,
        id: cursor.id,
      });
    }

    const rows = await query.getMany();
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    const nextCursor =
      rows.length > limit && last !== undefined
        ? encodeCursor({ statusAt: last.statusAt, id: last.id })
        : null;

    return { generatedAt: now.toISOString(), items: await this.cards(page), nextCursor };
  }

  /** 모든 화면 질의의 바닥: 억제 안 됨 + 게시 게이트 */
  private visible(): SelectQueryBuilder<Item> {
    return this.items
      .createQueryBuilder('item')
      .where('item.suppressed_at IS NULL')
      .andWhere(PUBLISHED);
  }

  private async cards(items: readonly Item[]): Promise<Card[]> {
    const assembled: AssembledCard[] = await this.assembler.assemble(items);
    return assembled.map((entry) => entry.card);
  }
}
