import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Brand } from '@/modules/brands/entities/brand.entity';
import { ItemMention } from '@/modules/item-mentions/entities/item-mention.entity';
import { Item } from '@/modules/items/entities/item.entity';
import { ItemCurrentSchedule } from '@/modules/scheduled-events/entities/item-current-schedule.view.entity';
import { StatusHistory } from '@/modules/status-histories/entities/status-history.entity';

import type { Card, Schedule, SourceRef } from './dto/card.dto';
import { summarizeRestocks } from './utils/restock';

/** 카드와 함께 캘린더가 쓰는 부산물. 응답에는 실리지 않는다 */
export interface AssembledCard {
  readonly card: Card;
  /** 과거 재입고 JST 달력일 (docs/read-api.md §4.1) */
  readonly restockDates: readonly string[];
}

/** `item_mention → mention → source` 조인의 한 행. `raw_payload`는 읽지 않는다 */
interface SourceLinkRow {
  readonly itemId: string;
  readonly url: string;
  readonly observedAt: Date;
  readonly code: string;
  readonly name: string;
  readonly imageAllowedAt: Date | null;
}

/**
 * `item` 행을 `Card`로 만든다 (docs/read-api.md §2). **읽기만 한다.**
 *
 * 카드 하나에 조인이 4개다 — 브랜드 · 유효 예정 · 출처 · 이력. N+1 대신 id 묶음으로 4번 읽는다.
 * 순서는 입력 순서를 보존한다. 정렬은 호출자의 일이다.
 */
@Injectable()
export class CardAssemblerService {
  constructor(
    @InjectRepository(Brand) private readonly brands: Repository<Brand>,
    @InjectRepository(ItemMention) private readonly links: Repository<ItemMention>,
    @InjectRepository(ItemCurrentSchedule)
    private readonly schedules: Repository<ItemCurrentSchedule>,
    @InjectRepository(StatusHistory) private readonly histories: Repository<StatusHistory>,
  ) {}

  async assemble(items: readonly Item[]): Promise<AssembledCard[]> {
    if (items.length === 0) return [];
    const ids = items.map((item) => item.id);

    const [brands, schedules, links, histories] = await Promise.all([
      this.loadBrands(items),
      this.schedules.find({ where: { itemId: In(ids) }, order: { observedAt: 'ASC' } }),
      this.loadSourceLinks(ids),
      // 전이 판정은 순서에 의존한다 (utils/restock.ts)
      this.histories.find({
        where: { itemId: In(ids) },
        order: { observedAt: 'ASC', id: 'ASC' },
        select: { itemId: true, status: true, observedAt: true, isBackfilled: true },
      }),
    ]);

    const schedulesByItem = groupBy(schedules, (row) => row.itemId);
    const linksByItem = groupBy(links, (row) => row.itemId);
    const historiesByItem = groupBy(histories, (row) => row.itemId);

    return items.map((item) => {
      const sourceRows = linksByItem.get(item.id) ?? [];
      const restocks = summarizeRestocks(historiesByItem.get(item.id) ?? []);
      return {
        card: toCard(
          item,
          item.brandId === null ? null : (brands.get(item.brandId) ?? null),
          (schedulesByItem.get(item.id) ?? []).map(toSchedule),
          sourceRows,
          restocks.restockedAt,
        ),
        restockDates: restocks.dates,
      };
    });
  }

  private async loadBrands(items: readonly Item[]): Promise<Map<string, Brand>> {
    const ids = [...new Set(items.map((item) => item.brandId).filter((id) => id !== null))];
    if (ids.length === 0) return new Map();
    const rows = await this.brands.find({ where: { id: In(ids) } });
    return new Map(rows.map((row) => [row.id, row]));
  }

  /**
   * 소스 하나에 1행 — 같은 소스의 mention이 여럿이면 **가장 최근 것**.
   * `mention.raw_payload`(jsonb, 90일치)를 끌어오지 않으려고 컬럼을 고른다.
   */
  private async loadSourceLinks(ids: readonly string[]): Promise<SourceLinkRow[]> {
    const raw = await this.links
      .createQueryBuilder('link')
      .innerJoin('link.mention', 'mention')
      .innerJoin('mention.source', 'source')
      .select('link.item_id', 'itemId')
      .addSelect('mention.url', 'url')
      .addSelect('mention.observed_at', 'observedAt')
      .addSelect('source.code', 'code')
      .addSelect('source.name', 'name')
      .addSelect('source.image_allowed_at', 'imageAllowedAt')
      .where('link.item_id IN (:...ids)', { ids })
      .orderBy('link.item_id', 'ASC')
      .addOrderBy('mention.observed_at', 'DESC')
      .getRawMany<SourceLinkRow>();

    const seen = new Set<string>();
    return raw.filter((row) => {
      const key = `${row.itemId}:${row.code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

function toCard(
  item: Item,
  brand: Brand | null,
  schedules: Schedule[],
  sourceRows: readonly SourceLinkRow[],
  restockedAt: Date | null,
): Card {
  // 이미지 게이트 (docs/read-api.md §6.2): 연결 소스 전부가 허가여야 낸다. 게시 게이트는 질의에서 이미 걸렀다
  const imageAllowed =
    sourceRows.length > 0 && sourceRows.every((row) => row.imageAllowedAt !== null);

  return {
    id: item.id,
    title: item.title,
    officialUrl: item.officialUrl,
    imageUrl: imageAllowed ? item.imageUrl : null,
    price: item.price,
    priceVaries: item.priceVaries,
    brand: brand === null ? null : { code: brand.code, label: brand.labelJa },
    channel: item.channel,
    region: item.region,
    acquisition: item.acquisition,
    seriesTotal: item.seriesTotal,
    labels: item.labels,
    status: item.status,
    statusAt: item.statusAt.toISOString(),
    preorderOn: item.preorderOn,
    releaseOn: item.releaseOn,
    timeEstimated: item.timeEstimated,
    availableUntil: item.availableUntil,
    restockedAt: restockedAt?.toISOString() ?? null,
    schedules,
    sources: sourceRows.map(toSourceRef),
  };
}

function toSchedule(row: ItemCurrentSchedule): Schedule {
  return {
    kind: row.kind,
    date: row.scheduledOn,
    text: row.scheduledText,
    undecided: row.undecided,
    observedAt: row.observedAt.toISOString(),
  };
}

function toSourceRef(row: SourceLinkRow): SourceRef {
  return { code: row.code, name: row.name, url: row.url, observedAt: row.observedAt.toISOString() };
}

function groupBy<T>(rows: readonly T[], keyOf: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    const bucket = map.get(key);
    if (bucket) bucket.push(row);
    else map.set(key, [row]);
  }
  return map;
}
