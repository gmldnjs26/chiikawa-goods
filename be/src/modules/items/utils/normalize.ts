import type { SourceConfig } from '@/modules/sources/dto/source-config.schema';
import { toPatterns } from '@/modules/sources/dto/source-config.schema';

import type { NormalizedItem } from '../dto/normalized-item.dto';
import type { Acquisition, Channel, ItemStatus } from '../entities/item.entity';
import { latestTagDate, matchTagDates } from './tag-date';
import { normalizeTitle, parseSeriesTotal } from './title-normalize';

/** `mention.raw_payload`가 갖는 형태. 화이트리스트를 통과한 것만 온다 */
interface PayloadVariant {
  readonly price?: unknown;
  readonly available?: unknown;
}

export interface NormalizeInput {
  readonly payload: Record<string, unknown>;
  readonly rawTitle: string;
  readonly url: string;
  readonly channel: Channel;
  readonly config: SourceConfig;
}

/**
 * `mention` → `item` (docs/source-mapping.md §2).
 *
 * **`item` = Shopify product 1개.** variant로 쪼개지 않는다 — 카드 1장이 굿즈 1개라는
 * 화면 규약을 깨지 않기 위해서다 (§2.1). 사이즈별 재고는 공식 페이지에 정확히 있다.
 */
export function normalize(input: NormalizeInput): NormalizedItem {
  const { payload, config } = input;
  const tags = stringArray(payload.tags);
  const collections = stringArray(payload._collections);
  const variants = Array.isArray(payload.variants) ? (payload.variants as PayloadVariant[]) : [];

  const prices = variants
    .map((variant) => toJpy(variant.price))
    .filter((price): price is number => price !== null);
  const availableCount = variants.filter((variant) => variant.available === true).length;

  const seriesTotal = parseSeriesTotal(input.rawTitle);
  const status = judgeStatus(tags, availableCount > 0, config);

  return {
    title: input.rawTitle,
    titleNorm: normalizeTitle(input.rawTitle),
    canonicalUrl: input.url,
    officialUrl: input.url,
    imageUrl: firstImageSrc(payload.images),
    price: prices.length === 0 ? null : Math.min(...prices),
    priceVaries: new Set(prices).size > 1,
    priceTaxIncluded: config.tax_included,
    variantAvailable: availableCount,
    variantTotal: variants.length,
    category: text(payload.product_type),
    vendor: text(payload.vendor),
    channel: input.channel,
    // `series_total`이 없으면 random으로 두지 않는다 — CHECK가 막고, 애초에 근거가 없다
    acquisition: resolveAcquisition(config.default_acquisition, seriesTotal),
    seriesTotal,
    region: config.default_region,
    labels: pickLabels(tags, config),
    status: status.value,
    statusConflict: status.conflict,
    priceUnparsed: variants.length > 0 && prices.length === 0,
    preorderOn: latestTagDate(tags, config.preorder_tag),
    releaseOn: latestTagDate(tags, config.release_tag),
    // 과거 재입고가 누적된다. 전부 넘긴다 — 백필의 입력이다 (§3.4)
    restockDates: matchTagDates(tags, config.restock_tag),
    collections,
  };
}

/**
 * 상태 판정 (docs/data-collection-design.md §3.2).
 *
 * **`available` 단독으로는 판정할 수 없다** — 예약 개시 전과 매진 후가 둘 다 `false`다.
 * `販売開始前` 태그와 반드시 함께 본다.
 *
 * 모순 조합(태그 있음 + available)은 조용히 한쪽으로 정하지 않는다. 태그 체계 변경의 첫 징후다.
 */
export function judgeStatus(
  tags: readonly string[],
  anyAvailable: boolean,
  config: SourceConfig,
): { value: ItemStatus; conflict: boolean } {
  const upcomingTags = toPatterns(config.upcoming_tag);
  const upcoming = upcomingTags.some((tag) => tags.includes(tag));

  if (upcoming && anyAvailable) return { value: 'UPCOMING', conflict: true };
  if (upcoming) return { value: 'UPCOMING', conflict: false };
  return { value: anyAvailable ? 'ON_SALE' : 'ENDED', conflict: false };
}

/**
 * 화이트리스트에 명시한 태그만 `labels`가 된다 (docs/source-mapping.md §3.1).
 *
 * 태그를 그대로 넣으면 `破棄対象商品`(폐기 대상) 같은 내부 운영 태그가 카드에 뜬다.
 * `label_tag_source: 'character_table'`은 참조 테이블이 아직 없다 —
 * 캐릭터 라벨을 **비운다.** 칩이 안 나올 뿐 오분류는 없다 ([[db-schema]] §14 #5).
 */
export function pickLabels(tags: readonly string[], config: SourceConfig): string[] {
  const allowed = new Set([...config.label_tags, ...config.label_tags_extra]);
  return tags.filter((tag) => allowed.has(tag));
}

function resolveAcquisition(fallback: string, seriesTotal: number | null): Acquisition {
  if (fallback === 'random' && seriesTotal !== null) return 'random';
  return 'fixed';
}

/**
 * Shopify는 가격을 문자열로 준다 (`"1870"`, 실측 3소스). JPY는 정수다 —
 * 소수는 반올림하지 않고 버린다. 전건이 버려지면 `priceUnparsed`로 올라가 경고가 난다
 */
function toJpy(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value !== 'string') return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function firstImageSrc(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  return text((images[0] as { src?: unknown }).src);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
