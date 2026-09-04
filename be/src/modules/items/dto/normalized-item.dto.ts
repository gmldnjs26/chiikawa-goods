import type { Acquisition, Channel, ItemStatus } from '../entities/item.entity';
import type { CalendarDate } from '../utils/tag-date';

/**
 * `mention` 하나를 정규화한 결과. `item` 행이 되기 전 형태다
 * (docs/source-mapping.md §2).
 *
 * **판정 못 한 값은 `null`이다.** 추측으로 채우지 않는다.
 */
export interface NormalizedItem {
  readonly title: string;
  readonly titleNorm: string;
  readonly canonicalUrl: string;
  readonly officialUrl: string;
  readonly imageUrl: string | null;
  readonly price: number | null;
  readonly priceVaries: boolean;
  readonly priceTaxIncluded: boolean;
  readonly variantAvailable: number;
  readonly variantTotal: number;
  readonly category: string | null;
  readonly vendor: string | null;
  readonly channel: Channel;
  readonly acquisition: Acquisition;
  readonly seriesTotal: number | null;
  readonly region: string;
  readonly labels: string[];
  readonly status: ItemStatus;
  readonly preorderOn: CalendarDate | null;
  readonly releaseOn: CalendarDate | null;
  /** 과거 재입고 전부. `status_history` 백필의 입력이다 (§3.4, 에픽 D) */
  readonly restockDates: CalendarDate[];
  /** 소속 컬렉션 handle. `drop_group` 묶음의 입력이다 */
  readonly collections: string[];
  /** 태그와 available이 모순이다 — 조용히 한쪽으로 정하지 않는다 (§3.3) */
  readonly statusConflict: boolean;
}
