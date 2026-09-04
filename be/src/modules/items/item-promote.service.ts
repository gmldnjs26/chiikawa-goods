import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { BrandRegistryService } from '@/modules/brands/brand-registry.service';
import { judgeBrand } from '@/modules/brands/utils/match-rules';
import { DropGroup } from '@/modules/drop-groups/entities/drop-group.entity';
import { groupByDate } from '@/modules/drop-groups/utils/grouping';
import { Mention } from '@/modules/mentions/entities/mention.entity';
import { SourceRegistryService } from '@/modules/sources/source-registry.service';

import { Channel, Item } from './entities/item.entity';
import { ItemMention } from './entities/item-mention.entity';
import { normalize } from './utils/normalize';

export interface PromoteResult {
  readonly seen: number;
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly conflicts: number;
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
export class ItemPromoteService {
  private readonly logger = new Logger(ItemPromoteService.name);

  constructor(
    private readonly registry: SourceRegistryService,
    private readonly brands: BrandRegistryService,
    @InjectRepository(Mention) private readonly mentions: Repository<Mention>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(DropGroup) private readonly drops: Repository<DropGroup>,
    @InjectRepository(ItemMention) private readonly links: Repository<ItemMention>,
  ) {}

  /**
   * `codes`가 비면 소스 전부.
   *
   * **`enabled`를 보지 않는다** — 정규화는 외부 요청이 0건이다. 수집 게이트를 여기 물리면
   * 문의 대기 중인 소스의 mention이 영영 item이 되지 못한다 (SourceRegistryService.loadAll).
   */
  async promoteAll(codes: string[]): Promise<PromoteResult> {
    const loaded = await this.registry.loadAll();
    const targets =
      codes.length === 0 ? loaded : loaded.filter((source) => codes.includes(source.row.code));

    const unknown = codes.filter((code) => !loaded.some((source) => source.row.code === code));
    if (unknown.length > 0) throw new Error(`모르는 소스다: ${unknown.join(', ')}`);

    const candidates = await this.brands.load();
    const totals = { seen: 0, created: 0, updated: 0, skipped: 0, conflicts: 0 };

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

        const brandId = judgeBrand(
          { tags: labelSource(mention.rawPayload), collections: item.collections, title: item.title },
          candidates,
        );
        const dropId = await this.resolveDrop(item, brandId);

        // mixed는 「다른 작품이 섞였을 수 있다」는 뜻이다. 빼지 않고 라벨로 알린다 (§7.2)
        const labels = mention.relevance === 'mixed' ? [...item.labels, '他キャラ混在'] : item.labels;

        const outcome = await this.upsert(item, { brandId, dropId, labels }, mention.id);
        totals[outcome] += 1;
      }
    }

    this.logger.log(
      `mention ${totals.seen}건 — 신규 ${totals.created} · 갱신 ${totals.updated} · 제외 ${totals.skipped} · 모순 ${totals.conflicts}`,
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
    resolved: { brandId: string | null; dropId: string | null; labels: string[] },
    mentionId: string,
  ): Promise<'created' | 'updated'> {
    const existing = await this.items.findOne({ where: { canonicalUrl: item.canonicalUrl } });

    const values = {
      ...item,
      brandId: resolved.brandId,
      dropId: resolved.dropId,
      labels: resolved.labels,
      statusAt: new Date(),
    };
    // DTO 전용 필드다. 컬럼이 아니다 — 상태 이력과 예정은 에픽 D가 만든다
    delete (values as Partial<Record<string, unknown>>).restockDates;
    delete (values as Partial<Record<string, unknown>>).collections;
    delete (values as Partial<Record<string, unknown>>).statusConflict;

    if (existing === null) {
      const saved = await this.items.save(this.items.create(values));
      await this.link(saved.id, mentionId);
      return 'created';
    }

    // 억제된 item은 되살리지 않는다. 삭제 요청 대응이 다음 수집에 뒤집히면 안 된다
    if (existing.suppressedAt !== null) {
      await this.link(existing.id, mentionId);
      return 'updated';
    }

    await this.items.update(existing.id, values);
    await this.link(existing.id, mentionId);
    return 'updated';
  }

  /** 같은 짝을 두 번 넣지 않는다. 재실행이 안전해야 한다 */
  private async link(itemId: string, mentionId: string): Promise<void> {
    await this.links
      .createQueryBuilder()
      .insert()
      .values({ itemId, mentionId, role: 'primary', linkedBy: 'auto' })
      .orIgnore()
      .execute();
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
        title: grouping.key,
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
