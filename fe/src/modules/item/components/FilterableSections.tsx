'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/lib/cn';
import type { Acquisition, Channel } from '@/lib/schema';
import {
  EmptyState,
  GroupedList,
  RowDivider,
  SectionHeader,
  type Tone,
} from '@/modules/_common/components/Section';
import {
  CHANNEL_LABELS,
  formatCount,
  UNKNOWN_BRAND_CODE,
  UNKNOWN_BRAND_LABEL,
} from '@/modules/_common/consts';

import { foldByDrop, type FoldedRow } from '../fold';

/** 필터에 필요한 것만 + 서버가 그린 카드. 카드 본체는 서버 컴포넌트 그대로다 (fe/CLAUDE.md §1) */
export interface FilterableCard {
  readonly id: string;
  readonly channel: Channel;
  readonly brandCode: string | null;
  readonly acquisition: Acquisition;
  readonly region: string;
  /** 소속 발표. 같은 `id`끼리 접는다. 이름은 서버가 만들어 준다 (docs/read-api.md §3.4) */
  readonly drop: { readonly id: string; readonly title: string } | null;
  readonly node: React.ReactNode;
}

export interface FilterableSection {
  readonly key: string;
  readonly tone: Tone;
  readonly title: string;
  readonly note?: React.ReactNode;
  readonly emptyText: string;
  readonly cards: readonly FilterableCard[];
  /** 전용 페이지. 있으면 `previewLimit`을 넘는 만큼 잘라내고 헤더가 링크가 된다 */
  readonly href?: string;
}

interface Filter {
  channels: ReadonlySet<Channel>;
  brands: ReadonlySet<string>;
  noRandom: boolean;
  onlineOnly: boolean;
}

const EMPTY_FILTER: Filter = {
  channels: new Set(),
  brands: new Set(),
  noRandom: false,
  onlineOnly: false,
};

/**
 * 필터 + 섹션 목록 (docs/plan.md §6.5). 채널 칩 · 브랜드 칩 · 체크박스 2개.
 * **클라이언트 로컬 상태**다. 요청을 날리지 않는다 — 이미 다 받았다 (fe/CLAUDE.md §4).
 * 브랜드 칩은 응답에 있는 브랜드만 낸다. 미판정은 `その他`로 **보여준다**.
 *
 * - 홈: `previewLimit`(5)까지만 보이고 넘치면 헤더의 `すべて ›`가 전용 페이지를 연다
 * - 전용 페이지: `pageSize`(30)씩 `もっと見る 残り N`. 서버 요청 없음 — 홈 응답이 전부 갖고 있다
 *
 * 필터 **뒤에** 같은 발표(`drop.id`)의 카드를 처음 나온 자리에 접는다 (docs/read-api.md §3.4).
 * 「N点」은 그 섹션 · 그 필터에서 보이는 건수다. 상한 · 残り는 행 단위로 센다 — 발표 하나가 한 행이다.
 */
export function FilterableSections({
  sections,
  brands,
  previewLimit,
  pageSize,
}: {
  sections: readonly FilterableSection[];
  brands: readonly { code: string; label: string }[];
  previewLimit?: number;
  pageSize?: number;
}) {
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [shown, setShown] = useState<number>(pageSize ?? Number.POSITIVE_INFINITY);

  const toggle = <T,>(set: ReadonlySet<T>, value: T): Set<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const channelsInUse = new Set(sections.flatMap((s) => s.cards.map((c) => c.channel)));
  const hasUnknownBrand = sections.some((s) => s.cards.some((c) => c.brandCode === null));
  const brandOptions = [
    ...brands,
    ...(hasUnknownBrand ? [{ code: UNKNOWN_BRAND_CODE, label: UNKNOWN_BRAND_LABEL }] : []),
  ];
  const filterActive =
    filter.channels.size > 0 || filter.brands.size > 0 || filter.noRandom || filter.onlineOnly;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CHANNEL_LABELS) as Channel[])
            .filter((channel) => channelsInUse.has(channel))
            .map((channel) => (
              <FilterChip
                key={channel}
                pressed={filter.channels.has(channel)}
                onClick={() => setFilter({ ...filter, channels: toggle(filter.channels, channel) })}
              >
                {CHANNEL_LABELS[channel]}
              </FilterChip>
            ))}
        </div>
        {brandOptions.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {brandOptions.map((brand) => (
              <FilterChip
                key={brand.code}
                pressed={filter.brands.has(brand.code)}
                onClick={() => setFilter({ ...filter, brands: toggle(filter.brands, brand.code) })}
              >
                {brand.label}
              </FilterChip>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-sm">
          <Checkbox
            checked={filter.noRandom}
            onChange={(noRandom) => setFilter({ ...filter, noRandom })}
          >
            ランダム商品を除く
          </Checkbox>
          <Checkbox
            checked={filter.onlineOnly}
            onChange={(onlineOnly) => setFilter({ ...filter, onlineOnly })}
          >
            オンラインのみ
          </Checkbox>
        </div>
      </div>

      {sections.map((section) => {
        const visible = section.cards.filter((card) => passes(card, filter));
        const folded = foldByDrop(visible);
        const overflow = previewLimit !== undefined && folded.length > previewLimit;
        const limit = overflow ? previewLimit : shown;
        const rows = folded.slice(0, limit);
        const remaining = folded.length - rows.length;
        return (
          <section key={section.key} className="flex flex-col gap-3">
            <SectionHeader
              tone={section.tone}
              title={section.title}
              count={visible.length}
              href={overflow ? section.href : undefined}
              note={section.note}
            />
            {visible.length === 0 ? (
              <EmptyState
                action={
                  filterActive ? (
                    <button
                      type="button"
                      onClick={() => setFilter(EMPTY_FILTER)}
                      className="flex min-h-11 items-center text-sm font-semibold text-accent"
                    >
                      フィルターを解除
                    </button>
                  ) : undefined
                }
              >
                {section.emptyText}
              </EmptyState>
            ) : (
              <GroupedList>
                {rows.map((row, index) => (
                  <div key={row.kind === 'card' ? row.card.id : `drop-${row.cards[0].id}`}>
                    {index > 0 && <RowDivider />}
                    {row.kind === 'card' ? row.card.node : <DropRow row={row} />}
                  </div>
                ))}
              </GroupedList>
            )}
            {pageSize !== undefined && remaining > 0 && (
              <button
                type="button"
                onClick={() => setShown(shown + pageSize)}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-semibold text-label"
              >
                もっと見る{' '}
                <span className="font-normal text-label-secondary">残り {remaining}</span>
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

/**
 * 접힌 발표 — 발표 이름 · 「N点」 머리줄, 첫 카드는 그대로 보이고 나머지는 `<details>`로 펼친다.
 * 카드 본체는 서버가 그린 노드 그대로다 — 뱃지 · 날짜 · 가격은 카드마다 다를 수 있다.
 */
function DropRow({ row }: { row: Extract<FoldedRow<FilterableCard>, { kind: 'drop' }> }) {
  const [first, ...rest] = row.cards;
  return (
    <div>
      <div className="flex items-center gap-1.5 px-3.5 pt-2.5 text-xs text-label-secondary">
        <span className="font-semibold">{row.title}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{formatCount(row.cards.length)}</span>
      </div>
      {first.node}
      <details className="group">
        <summary className="-mt-1 flex min-h-11 cursor-pointer list-none items-center gap-1 px-3.5 text-sm font-semibold text-label [&::-webkit-details-marker]:hidden">
          <ChevronDown
            aria-hidden
            className="size-4 text-label-tertiary transition-transform group-open:rotate-180 motion-reduce:transition-none"
            strokeWidth={2}
          />
          <span className="group-open:hidden">他{formatCount(rest.length)}を表示</span>
          <span className="hidden group-open:inline">閉じる</span>
        </summary>
        {rest.map((card) => (
          <div key={card.id}>
            <RowDivider />
            {card.node}
          </div>
        ))}
      </details>
    </div>
  );
}

function passes(card: FilterableCard, filter: Filter): boolean {
  if (filter.channels.size > 0 && !filter.channels.has(card.channel)) return false;
  if (filter.brands.size > 0 && !filter.brands.has(card.brandCode ?? UNKNOWN_BRAND_CODE))
    return false;
  if (filter.noRandom && card.acquisition === 'random') return false;
  // region은 「그 장소에 가야 하는가」다. 온라인 공식이거나 region이 online이면 집에서 산다
  if (filter.onlineOnly && !(card.channel === 'online_official' || card.region === 'online'))
    return false;
  return true;
}

/** 필터 칩 — 테두리. 선택은 label 채움 (액센트가 아니다 — 액센트는 링크 · 탭 · 체크에만) */
function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-8 items-center rounded-lg border px-2.5 text-[13px] whitespace-nowrap transition-colors',
        pressed ? 'border-label bg-label text-background' : 'border-border text-label',
      )}
    >
      {children}
    </button>
  );
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded accent-accent"
      />
      {children}
    </label>
  );
}
