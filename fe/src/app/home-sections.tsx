import type { Card, HomeResponse } from '@/lib/schema';
import type { Tone } from '@/modules/_common/components/Section';
import { formatDropTitle } from '@/modules/_common/consts';
import {
  type FilterableCard,
  type FilterableSection,
} from '@/modules/item/components/FilterableSections';
import { Estimated, ItemCard } from '@/modules/item/components/ItemCard';
import { RESTOCK_BADGE_DAYS } from '@/modules/item/consts';

/**
 * 홈 3섹션의 정의. 홈(`/`)과 전용 페이지(`/now` · `/soon` · `/restock`)가 같은 것을 쓴다.
 * 섹션 소속은 API가 정했다 (docs/read-api.md §3.1). 여기는 문안과 조립뿐이다.
 */
export const HOME_SECTIONS = {
  now: {
    key: 'onSale',
    tone: 'on-sale',
    title: '今すぐ買える',
    note: `販売中と、${RESTOCK_BADGE_DAYS}日以内に再入荷したもの。最近開いた順。`,
    emptyText: '条件に合う商品がありません',
  },
  soon: {
    key: 'upcoming',
    tone: 'upcoming',
    title: 'もうすぐ',
    note: (
      <>
        8日前から当日まで。開始時刻は公式サイトに記載がないため
        <Estimated />
        です。
      </>
    ),
    emptyText: '予定されている発表はありません',
  },
  restock: {
    key: 'waitable',
    tone: 'restock',
    title: '再入荷を待てる',
    note: '品切れですが再入荷が告知されています。時期のみの告知はそのまま表示します。',
    emptyText: '再入荷予定の告知はありません',
  },
} as const satisfies Record<
  string,
  { key: keyof HomeResponse; tone: Tone; title: string; note: React.ReactNode; emptyText: string }
>;

export type HomeSectionSlug = keyof typeof HOME_SECTIONS;

export function isHomeSectionSlug(value: string): value is HomeSectionSlug {
  // `in`은 프로토타입 체인을 탄다 — `/toString`이 통과한다. 자기 키만
  return Object.hasOwn(HOME_SECTIONS, value);
}

export function buildSection(
  home: HomeResponse,
  slug: HomeSectionSlug,
  withHref: boolean,
): FilterableSection {
  const meta = HOME_SECTIONS[slug];
  const cards = home[meta.key];
  return {
    key: meta.key,
    tone: meta.tone,
    title: meta.title,
    note: meta.note,
    emptyText: meta.emptyText,
    cards: cards.map((card) => toFilterable(card, home.today)),
    href: withHref ? `/${slug}` : undefined,
  };
}

/** 응답에 있는 브랜드만. 필터 칩의 후보다 */
export function brandsOf(home: HomeResponse): { code: string; label: string }[] {
  const all = [...home.onSale, ...home.upcoming, ...home.waitable];
  return [
    ...new Map(all.flatMap((c) => (c.brand ? [[c.brand.code, c.brand] as const] : []))).values(),
  ];
}

/** 발표 이름은 서버에서 만든다 — 필터(클라이언트)는 키와 이름만 받아 접는다 (docs/read-api.md §3.4) */
function toFilterable(card: Card, today: string): FilterableCard {
  return {
    id: card.id,
    channel: card.channel,
    brandCode: card.brand?.code ?? null,
    acquisition: card.acquisition,
    region: card.region,
    drop:
      card.drop === null
        ? null
        : { id: card.drop.id, title: formatDropTitle(card.drop, card.brand) },
    node: <ItemCard card={card} today={today} />,
  };
}
