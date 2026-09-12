import { cn } from '@/lib/cn';
import {
  formatDate,
  formatPrice,
  formatScheduleWhen,
  formatSeriesTotal,
  toJstCalendarDate,
} from '@/lib/format';
import type { Card, Schedule } from '@/lib/schema';
import { BrandChip, InfoChip, SeriesChip, SeriesLabel } from '@/modules/_common/components/Chip';
import {
  brandInitial,
  CHANNEL_LABELS,
  ISSUES_URL,
  regionLabel,
  SCHEDULE_KIND_LABELS,
  TIME_ESTIMATED_LABEL,
  TIME_ESTIMATED_TITLE,
} from '@/modules/_common/consts';

import { type Badge, judgeBadge, upcomingDates } from '../badge';
import { CardImage } from './CardImage';
import { SourceLinks } from './SourceLinks';
import { railClass, StatusBadge } from './StatusBadge';

/**
 * 카드 1종. 세 화면이 같은 카드를 그린다 (docs/plan.md §6.3). 디자인 플랜 v1의 행 구조:
 * 왼쪽 2px 상태 레일 → [브랜드 칩 … 뱃지] → [이미지 | 상품명(+全N種) / 채널 · 지역 · 정보칩 / 날짜 … 가격] → [出典 … 公式ページ].
 *
 * 필수 4요소: 브랜드 칩 · 채널 · 지역 · 확정/랜덤(`全N種`). 이 4개로 「내가 살 수 있는 물건인지」가 판정된다.
 * 이미지 게이트는 여기 없다 — API가 `imageUrl`을 null로 준다 (docs/read-api.md §6.2).
 * 完売만 카드 전체 톤다운. 재입고 예고 · 미정 · 判定不可는 톤다운하지 않는다 — 죽은 카드가 아니다.
 *
 * 클라이언트 지시어가 없다. 아카이브 페이지네이션(클라이언트)에서도 쓰이므로 서버 전용 API를 부르지 않는다.
 */
export function ItemCard({ card, today }: { card: Card; today: string }) {
  const badge = judgeBadge(card, today);
  const muted = badge.kind === 'sold-out';
  const price = formatPrice(card.price, card.priceVaries);
  const secondary = muted ? 'text-label-tertiary' : 'text-label-secondary';

  return (
    <article className={cn('flex', railClass(badge))}>
      <div className="flex flex-1 flex-col gap-1.5 py-3 pr-3 pl-3.5">
        <div className="flex items-center justify-between gap-2">
          <BrandChip brand={card.brand} muted={muted} />
          <StatusBadge badge={badge} />
        </div>

        <div className="flex gap-3">
          <CardImage src={card.imageUrl} initial={brandInitial(card.brand)} muted={muted} />
          <div className="min-w-0 flex-1">
            <h3 className="text-base leading-[1.4] font-semibold">
              <a
                href={card.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('no-underline hover:underline', muted ? 'text-ended' : 'text-label')}
              >
                {card.title}
              </a>
              {card.acquisition === 'random' && (
                <SeriesLabel muted={muted}>{formatSeriesTotal(card.seriesTotal)}</SeriesLabel>
              )}
            </h3>

            <div
              className={cn(
                'mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm',
                secondary,
              )}
            >
              <span>{CHANNEL_LABELS[card.channel]}</span>
              <span aria-hidden>·</span>
              <span>{regionLabel(card.region)}</span>
              {card.series.map((series) => (
                <SeriesChip key={series} series={series} muted={muted} />
              ))}
              {card.labels.map((label) => (
                <InfoChip key={label}>{label}</InfoChip>
              ))}
            </div>

            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <DateLine card={card} badge={badge} muted={muted} />
              {price !== null && (
                <span
                  className={cn(
                    'ml-auto text-base font-semibold',
                    muted ? 'text-ended' : 'text-label',
                  )}
                >
                  {price}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2 border-t border-separator pt-2 text-xs">
          <SourceLinks sources={card.sources} muted={muted} />
          <a
            href={card.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex shrink-0 items-center gap-1 py-2 pl-2 font-semibold whitespace-nowrap no-underline hover:underline',
              muted && 'text-label-tertiary',
            )}
          >
            公式ページ <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
    </article>
  );
}

/**
 * 가격 왼쪽의 날짜 줄. 상태별로 하나다.
 * - UPCOMING: `9/9(水) 予約開始  9/19(土) 発売  時刻は推定` — 날짜는 확정(굵게), 시각은 추정(점선)
 * - 방금 재입고: `9/5(金) 再入荷` (on-sale 색)
 * - 판매 종료일: `〜9/12(土)`
 * - ENDED + 재입고 예정: `9/15(火) 再入荷予定` / `再入荷予定 9月下旬` / `再入荷は未定と告知`
 * - 判定不可: `予定が重複しています · 報告`
 */
function DateLine({ card, badge, muted }: { card: Card; badge: Badge; muted: boolean }) {
  const secondary = muted ? 'text-label-tertiary' : 'text-label-secondary';

  if (badge.kind === 'unknown') {
    return (
      <span className={cn('text-sm', secondary)}>
        予定が重複しています ·{' '}
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
          報告
        </a>
      </span>
    );
  }

  if (card.status === 'UPCOMING') {
    // 뱃지(D-n)와 같은 순수함수를 본다. 판정을 JSX에서 되풀이하지 않는다 (fe/CLAUDE.md §5)
    const entries = upcomingDates(card);
    if (entries.length === 0) return null;
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
        {entries.map((entry) => (
          <span key={`${entry.kind}-${entry.date}`}>
            <b className="font-semibold">{formatDate(entry.date)}</b>{' '}
            {SCHEDULE_KIND_LABELS[entry.kind]}
          </span>
        ))}
        {card.timeEstimated && <Estimated />}
      </span>
    );
  }

  if (badge.kind === 'restocked' && card.restockedAt !== null) {
    return (
      <span className="text-sm text-on-sale">
        <b className="font-semibold">{formatDate(toJstCalendarDate(card.restockedAt))}</b> 再入荷
      </span>
    );
  }

  if (card.status === 'ENDED') {
    const restock = card.schedules.find((s) => s.kind === 'restock');
    if (restock !== undefined) return <RestockLine schedule={restock} secondary={secondary} />;
    return null;
  }

  if (card.availableUntil !== null) {
    return <span className={cn('text-sm', secondary)}>〜{formatDate(card.availableUntil)}</span>;
  }
  return null;
}

function RestockLine({ schedule, secondary }: { schedule: Schedule; secondary: string }) {
  if (schedule.undecided)
    return <span className={cn('text-sm', secondary)}>再入荷は未定と告知</span>;
  if (schedule.date !== null) {
    return (
      <span className="text-sm">
        <b className="font-semibold">{formatDate(schedule.date)}</b> 再入荷予定
      </span>
    );
  }
  const when = formatScheduleWhen(schedule);
  // 「9月下旬」은 원문 그대로. 표기할 것이 없으면 줄 자체를 내지 않는다 — 뱃지(完売)와 다른 말을 하지 않는다
  return when === null ? null : <span className="text-sm">再入荷予定 {when}</span>;
}

/** 「時刻は推定」 — 점선 밑줄. 확정인 척하지 않는다 */
export function Estimated() {
  return (
    <span
      className="cursor-help text-label-secondary underline decoration-dotted underline-offset-[3px]"
      title={TIME_ESTIMATED_TITLE}
    >
      {TIME_ESTIMATED_LABEL}
    </span>
  );
}
