import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BrandsService } from '@/modules/brands/brands.service';
import { judgeBrand } from '@/modules/brands/utils/match-rules';
import { DropGroup } from '@/modules/drop-groups/entities/drop-group.entity';
import { groupByDate } from '@/modules/drop-groups/utils/grouping';
import { ItemMentionsService } from '@/modules/item-mentions/item-mentions.service';
import { Mention } from '@/modules/mentions/entities/mention.entity';
import { SCHEDULE_KINDS } from '@/modules/scheduled-events/entities/scheduled-event.entity';
import { ScheduledEventsService } from '@/modules/scheduled-events/scheduled-events.service';
import { schedulesFromTags } from '@/modules/scheduled-events/utils/schedule-from-tags';
import { SourcesService } from '@/modules/sources/sources.service';
import { StatusHistoriesService } from '@/modules/status-histories/status-histories.service';

import { Channel, Item } from './entities/item.entity';
import { normalize } from './utils/normalize';

export interface PromoteResult {
  readonly seen: number;
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly conflicts: number;
  /** `status_history` 실시간 전이 행 */
  readonly transitions: number;
  /** `status_history` 백필 행 (재입고 태그) */
  readonly backfilled: number;
  /** `scheduled_event` 신규 행 */
  readonly scheduled: number;
}

interface Resolved {
  readonly brandId: string | null;
  readonly dropId: string | null;
  readonly labels: string[];
  /** 그 mention의 관측 시각. 이력·예정의 `observed_at`이 된다 */
  readonly observedAt: Date;
}

interface UpsertResult {
  readonly outcome: 'created' | 'updated';
  readonly transitions: number;
  readonly backfilled: number;
  readonly scheduled: number;
}

/**
 * `mention` → `item` 승격 (docs/source-mapping.md §2).
 *
 * **`mention`은 절대 수정하지 않는다.** 정규화가 틀렸으면 여기를 고치고 다시 돌린다 —
 * 그래서 이 작업은 몇 번을 돌려도 같은 결과여야 한다.
 *
 * 승격 대상은 `included` + `mixed`다. `mixed`는 수록하되 라벨을 붙인다 (§7.1).
 */
@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    private readonly registry: SourcesService,
    private readonly brands: BrandsService,
    private readonly links: ItemMentionsService,
    private readonly histories: StatusHistoriesService,
    private readonly schedules: ScheduledEventsService,
    @InjectRepository(Mention) private readonly mentions: Repository<Mention>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(DropGroup) private readonly drops: Repository<DropGroup>,
  ) {}

  /**
   * `codes`가 비면 소스 전부.
   *
   * **`enabled`를 보지 않는다** — 정규화는 외부 요청이 0건이다. 수집 게이트를 여기 물리면
   * 문의 대기 중인 소스의 mention이 영영 item이 되지 못한다 (SourcesService.loadAll).
   */
  async promoteAll(codes: string[]): Promise<PromoteResult> {
    const loaded = await this.registry.loadAll();
    const targets =
      codes.length === 0 ? loaded : loaded.filter((source) => codes.includes(source.row.code));

    const unknown = codes.filter((code) => !loaded.some((source) => source.row.code === code));
    if (unknown.length > 0) throw new Error(`모르는 소스다: ${unknown.join(', ')}`);

    const candidates = await this.brands.load();
    const totals = {
      seen: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      conflicts: 0,
      transitions: 0,
      backfilled: 0,
      scheduled: 0,
    };

    for (const source of targets) {
      // 같은 상품의 mention이 여러 개다(내용이 바뀔 때마다 쌓인다).
      // 오래된 것부터 처리해서 **가장 최근 관측이 마지막에 이긴다**
      const rows = await this.mentions.find({
        where: { sourceId: source.row.id },
        order: { observedAt: 'ASC', id: 'ASC' },
      });

      for (const mention of rows) {
        totals.seen += 1;

        // excluded는 화면에 나오지 않는다. 행은 남아 있으므로 규칙을 고치면 재처리된다
        if (mention.relevance === 'excluded' || mention.rawPayload === null) {
          totals.skipped += 1;
          continue;
        }

        const item = normalize({
          payload: mention.rawPayload,
          rawTitle: mention.rawTitle,
          url: mention.url,
          channel: source.row.channel as Channel,
          config: source.config,
        });

        if (item.statusConflict) {
          totals.conflicts += 1;
          // 조용히 한쪽으로 정하지 않는다. 태그 체계 변경의 첫 징후다 (§3.3)
          this.logger.warn(
            `${source.row.code}: 販売開始前인데 재고가 있다 — ${mention.url}. UPCOMING으로 두고 사람이 본다`,
          );
        }

        if (item.priceUnparsed) {
          // 250건 상한과 같은 부류다 — 조용한 누락이 가장 위험하다 (docs/source-mapping.md §1)
          this.logger.warn(
            `${source.row.code}: variant는 있는데 가격을 못 읽었다 — ${mention.url}`,
          );
        }

        const brandId = judgeBrand(
          {
            tags: labelSource(mention.rawPayload),
            collections: item.collections,
            title: item.title,
          },
          candidates,
        );
        const dropId = await this.resolveDrop(item, brandId);

        // mixed는 「다른 작품이 섞였을 수 있다」는 뜻이다. 빼지 않고 라벨로 알린다 (§7.2)
        const labels =
          mention.relevance === 'mixed' ? [...item.labels, '他キャラ混在'] : item.labels;

        const result = await this.upsert(
          item,
          { brandId, dropId, labels, observedAt: mention.observedAt },
          mention.id,
        );
        totals[result.outcome] += 1;
        totals.transitions += result.transitions;
        totals.backfilled += result.backfilled;
        totals.scheduled += result.scheduled;
      }
    }

    this.logger.log(
      `mention ${totals.seen}건 — 신규 ${totals.created} · 갱신 ${totals.updated} · 제외 ${totals.skipped} · 모순 ${totals.conflicts}` +
        ` / 전이 ${totals.transitions} · 백필 ${totals.backfilled} · 예정 ${totals.scheduled}`,
    );
    return totals;
  }

  /**
   * `canonical_url`이 소스 간 동일 판정 1순위다 (docs/data-collection-design.md §9.2).
   * 2단계(제목 유사도)와 3단계(수동 병합)는 소스가 늘어난 뒤에 붙인다 — 지금은 소스가 전부
   * Shopify라 URL이 유일 키로 작동한다.
   */
  private async upsert(
    item: ReturnType<typeof normalize>,
    resolved: Resolved,
    mentionId: string,
  ): Promise<UpsertResult> {
    const existing = await this.items.findOne({ where: { canonicalUrl: item.canonicalUrl } });

    // `status_at`은 **상태가 실제로 바뀐 관측 시각**이다. 벽시계가 아니다.
    // 매 실행 now()로 덮으면 「몇 번 돌려도 같은 결과」가 깨지고, 관측 근거 없는
    // 전이 시각이 생겨 status_history 입력을 오염시킨다.
    // 근거는 그 mention의 observed_at이다 — 정규화를 언제 돌렸는지는 무관하다
    const statusChanged = existing === null || existing.status !== item.status;
    const statusAt = statusChanged ? resolved.observedAt : existing.statusAt;

    const values = {
      ...item,
      brandId: resolved.brandId,
      dropId: resolved.dropId,
      labels: resolved.labels,
      statusAt,
    };
    // DTO 전용 필드다. 컬럼이 아니다 — 이력과 예정은 아래 recordLayers가 만든다
    delete (values as Partial<Record<string, unknown>>).restockDates;
    delete (values as Partial<Record<string, unknown>>).collections;
    delete (values as Partial<Record<string, unknown>>).statusConflict;
    delete (values as Partial<Record<string, unknown>>).priceUnparsed;

    if (existing === null) {
      const saved = await this.items.save(this.items.create(values));
      await this.links.link(saved.id, mentionId);
      const layers = await this.recordLayers(saved.id, item, resolved.observedAt, mentionId, true);
      return { outcome: 'created', ...layers };
    }

    // 억제된 item은 되살리지 않는다. 삭제 요청 대응이 다음 수집에 뒤집히면 안 된다.
    // 이력·예정도 쌓지 않는다 — 화면에 안 나오는 것의 전이는 알림 근거가 아니다
    if (existing.suppressedAt !== null) {
      await this.links.link(existing.id, mentionId);
      return { outcome: 'updated', transitions: 0, backfilled: 0, scheduled: 0 };
    }

    await this.items.update(existing.id, values);
    await this.links.link(existing.id, mentionId);
    const layers = await this.recordLayers(
      existing.id,
      item,
      resolved.observedAt,
      mentionId,
      statusChanged,
    );
    return { outcome: 'updated', ...layers };
  }

  /**
   * 상태 아래 두 층 — 전이(`status_history`)와 예정(`scheduled_event`).
   * 둘 다 append-only이고 **소급 불가**다. 관측 시각은 전부 그 mention의 `observed_at`이다.
   *
   * `item.status`는 최신 전이 행의 사본이다 (docs/db-schema.md §8). 그래서 첫 관측도 1행이다
   */
  private async recordLayers(
    itemId: string,
    item: ReturnType<typeof normalize>,
    observedAt: Date,
    mentionId: string,
    statusChanged: boolean,
  ): Promise<Omit<UpsertResult, 'outcome'>> {
    // 상태가 안 바뀌어도 이력이 비어 있으면 첫 행을 넣는다 — 이력 테이블보다 먼저 생긴 item이다.
    // 재실행에서는 이미 행이 있으므로 걸리지 않는다
    const needsFirstRow = !statusChanged && !(await this.histories.hasAny(itemId));

    let transitions = 0;
    if (statusChanged || needsFirstRow) {
      const inserted = await this.histories.record({
        itemId,
        status: item.status,
        observedAt,
        mentionId,
      });
      if (inserted) transitions += 1;
    }

    const backfilled = await this.histories.backfill({
      itemId,
      restockDates: item.restockDates,
      observedAt,
      mentionId,
    });

    const desired = schedulesFromTags(item, observedAt);
    let scheduled = 0;
    for (const kind of SCHEDULE_KINDS) {
      const outcome = await this.schedules.reconcile({
        itemId,
        kind,
        desired: desired[kind],
        observedAt,
        mentionId,
      });
      if (outcome === 'created') scheduled += 1;
    }

    return { transitions, backfilled, scheduled };
  }

  /**
   * 컬렉션 묶음은 컬렉션 title이 필요한데 `products.json`에 없다 —
   * 지금은 2순위(`날짜 + 브랜드 + kind`)만 쓴다 (docs/db-schema.md §6).
   *
   * 브랜드 미판정은 묶지 않는다. 같은 날 `その他`끼리 뭉치면 관계없는 굿즈가 한 발표가 된다.
   */
  private async resolveDrop(
    item: ReturnType<typeof normalize>,
    brandId: string | null,
  ): Promise<string | null> {
    const grouping = groupByDate({
      releaseOn: item.releaseOn,
      preorderOn: item.preorderOn,
      brandId,
      restockDates: item.restockDates,
    });
    if (grouping === null) return null;

    // 동시 실행이 같은 키로 들어와도 행이 둘로 갈리지 않는다
    await this.drops
      .createQueryBuilder()
      .insert()
      .values({
        groupingKey: grouping.key,
        // 표시용 제목은 컬렉션 title이 있어야 만들 수 있는데 products.json에 없다.
        // 기계 키를 사용자 대면 컬럼에 넣지 않는다 — 비워 두고 화면은 primary_date+kind로 낸다
        title: null,
        kind: grouping.kind,
        primaryDate: grouping.primaryDate,
      })
      .orIgnore()
      .execute();

    const row = await this.drops.findOne({ where: { groupingKey: grouping.key } });
    return row?.id ?? null;
  }
}

/** 브랜드 판정은 원문 태그를 본다 — `labels`는 화이트리스트를 거친 뒤라 근거가 사라진다 */
function labelSource(payload: Record<string, unknown>): string[] {
  return Array.isArray(payload.tags)
    ? payload.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];
}
