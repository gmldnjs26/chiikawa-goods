import type { DropKind } from '@/modules/drop-groups/entities/drop-group.entity';
import type { Acquisition, Channel, ItemStatus } from '@/modules/items/entities/item.entity';
import type { ScheduleKind } from '@/modules/scheduled-events/entities/scheduled-event.entity';

/**
 * 읽기 API 응답 형태 (docs/read-api.md §2). **`fe/src/lib/schema.ts`의 zod와 같은 형태다.**
 * 여기를 바꾸면 문서와 zod를 같이 바꾼다.
 *
 * 테이블명 · 3층 구조가 새지 않는다. 화면이 알아야 하는 것은 「뱃지와 날짜」뿐이다.
 * 시각은 ISO 8601 문자열, 날짜는 JST 달력일 `YYYY-MM-DD`, id는 문자열(bigint).
 */
export interface Card {
  readonly id: string;
  readonly title: string;
  readonly officialUrl: string;
  /** 원본 CDN. 이미지 게이트(§6.2) 미허가면 null — 카드는 선다 */
  readonly imageUrl: string | null;
  readonly price: number | null;
  readonly priceVaries: boolean;
  /** null = 미판정. 화면이 `その他`로 보여준다 */
  readonly brand: { readonly code: string; readonly label: string } | null;
  readonly channel: Channel;
  readonly region: string;
  readonly acquisition: Acquisition;
  readonly seriesTotal: number | null;
  readonly labels: readonly string[];
  /** 소속 시리즈. 첫 원소가 대표. 없으면 [] */
  readonly series: readonly string[];
  readonly status: ItemStatus;
  readonly statusAt: string;
  readonly preorderOn: string | null;
  readonly releaseOn: string | null;
  readonly timeEstimated: boolean;
  readonly availableUntil: string | null;
  /** 가장 최근 재입고 시각. 「방금」의 폭은 화면의 표시 규칙이다 */
  readonly restockedAt: string | null;
  /** 유효 예정 전부. 같은 kind가 2건 이상일 수 있다 — collapse하지 않는다 (§2.3) */
  readonly schedules: readonly Schedule[];
  /** 출처 표기. 소스 하나에 1건 */
  readonly sources: readonly SourceRef[];
  /** 소속 발표 (§2.5). null = 묶이지 않았다. 브랜드 미판정이면 항상 null */
  readonly drop: Drop | null;
}

/** `drop_group` 행 그대로. `title`이 null이면 화면이 브랜드 · 날짜 · kind로 이름을 만든다 */
export interface Drop {
  readonly id: string;
  readonly kind: DropKind;
  readonly date: string | null;
  readonly title: string | null;
}

export interface Schedule {
  readonly kind: ScheduleKind;
  readonly date: string | null;
  /** `9月下旬` 원문. 날짜로 바꾸지 않는다 */
  readonly text: string | null;
  readonly undecided: boolean;
  readonly observedAt: string;
}

export interface SourceRef {
  readonly code: string;
  readonly name: string;
  readonly url: string;
  readonly observedAt: string;
}

export interface HomeResponse {
  readonly generatedAt: string;
  /** 섹션 판정의 기준 JST 달력일 */
  readonly today: string;
  readonly onSale: readonly Card[];
  readonly upcoming: readonly Card[];
  readonly waitable: readonly Card[];
}

/**
 * 사건 하나 = 같은 날짜 · kind · 채널 · 브랜드의 카드 전부 (§4.0).
 * `brand`가 null이면 접지 않은 것이고 `items`는 1건이다.
 */
export interface CalendarEvent {
  readonly date: string;
  readonly kind: ScheduleKind;
  readonly brand: Card['brand'];
  /** 1건 이상. title → id 순 */
  readonly items: readonly Card[];
}

export interface CalendarResponse {
  readonly generatedAt: string;
  readonly today: string;
  readonly from: string;
  readonly to: string;
  /** date → channel → 접힌 것 먼저 → 첫 카드 title 순 */
  readonly events: readonly CalendarEvent[];
}

export interface ArchiveResponse {
  readonly generatedAt: string;
  readonly items: readonly Card[];
  /** null = 마지막 페이지 */
  readonly nextCursor: string | null;
}
