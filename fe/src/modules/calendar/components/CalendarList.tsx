import { ChevronDown } from 'lucide-react';

import { cn } from '@/lib/cn';
import { formatPrice, formatSeriesTotal, formatWeekday } from '@/lib/format';
import type { CalendarEvent, Card, Channel, ScheduleKind } from '@/lib/schema';
import { EmptyState } from '@/modules/_common/components/Section';
import {
  CHANNEL_LABELS,
  formatCount,
  SCHEDULE_KIND_LABELS,
  TIME_ESTIMATED_LABEL,
  TIME_ESTIMATED_TITLE,
  UNKNOWN_BRAND_LABEL,
} from '@/modules/_common/consts';

import { foldedEventTitle } from '../event-title';

/**
 * 캘린더 (docs/plan.md §6.4). **굿즈가 아니라 사건**이다 — 같은 굿즈가 예약일·발매일에 두 번 나온다.
 * 열 구조(디자인 플랜 v1): 날짜 44px → [채널 라벨 → 사건 56px(색 텍스트) | 색 레일 | 브랜드 / 상품명 / 메타].
 * 오늘은 액센트 + surface 배경. 지난 날짜는 전부 회색. 격자 없음 — 사건 있는 날만 행이 생긴다.
 * 여기 오는 사건은 전부 `date`가 있다. `9月下旬`은 캘린더에 놓을 자리가 없다 — 홈 목록에만 나온다.
 *
 * 사건은 API가 **발표 단위로 접어 준다** (docs/read-api.md §4.0). `items`가 2건 이상이면 한 행에
 * 「発売 51点」으로 내고 `<details>`로 펼친다 — 클라이언트 상태 없이 서버 컴포넌트 그대로다.
 */
export function CalendarList({
  events,
  today,
}: {
  events: readonly CalendarEvent[];
  today: string;
}) {
  if (events.length === 0) return <EmptyState>この期間に予定はありません</EmptyState>;

  const days = groupConsecutive(events, (event) => event.date);

  return (
    <ol>
      {days.map(([date, dayEvents], index) => {
        const isToday = date === today;
        const past = date < today;
        const channels = groupConsecutive(dayEvents, (event) => event.items[0].channel);
        return (
          <li key={date}>
            {index > 0 && <div className="ml-[72px] h-px bg-separator" aria-hidden />}
            <div className={cn('flex gap-3 px-4 pt-3.5 pb-3', isToday && 'bg-surface')}>
              <div className="w-11 shrink-0 text-right">
                <div
                  className={cn(
                    'text-xl leading-[1.1] font-semibold',
                    isToday ? 'text-accent' : past ? 'text-label-tertiary' : 'text-label',
                  )}
                >
                  {Number(date.slice(8))}
                </div>
                <div
                  className={cn(
                    'mt-0.5 text-xs',
                    isToday ? 'text-accent' : past ? 'text-label-tertiary' : 'text-label-secondary',
                  )}
                >
                  {isToday ? '今日' : `(${formatWeekday(date)})`}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                {channels.map(([channel, channelEvents]) => (
                  <ChannelGroup
                    key={channel}
                    channel={channel}
                    events={channelEvents}
                    past={past}
                  />
                ))}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const KIND_TEXT: Record<ScheduleKind, string> = {
  preorder: 'text-upcoming',
  release: 'text-on-sale',
  restock: 'text-restock',
};
const KIND_RAIL: Record<ScheduleKind, string> = {
  preorder: 'border-upcoming',
  release: 'border-on-sale',
  restock: 'border-restock',
};

function ChannelGroup({
  channel,
  events,
  past,
}: {
  channel: Channel;
  events: readonly CalendarEvent[];
  past: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          'mt-1.5 mb-0.5 text-xs font-semibold',
          past ? 'text-label-tertiary' : 'text-label-secondary',
        )}
      >
        {CHANNEL_LABELS[channel]}
      </div>
      {events.map((event, index) => (
        // 같은 item · 같은 kind가 2건 올 수 있다 (뷰가 DISTINCT ON을 뺐다). index로 구분한다
        <div key={`${event.kind}-${event.items[0].id}-${index}`} className="flex gap-2.5 py-2">
          <div
            className={cn(
              'w-14 shrink-0 pt-px text-sm font-semibold',
              past ? 'text-label-tertiary' : KIND_TEXT[event.kind],
            )}
          >
            {SCHEDULE_KIND_LABELS[event.kind]}
          </div>
          <div
            className={cn(
              'min-w-0 flex-1 border-l-2 pl-2.5',
              past ? 'border-border' : KIND_RAIL[event.kind],
            )}
          >
            <div className={cn('text-xs', past ? 'text-label-tertiary' : 'text-label-secondary')}>
              {event.brand?.label ?? UNKNOWN_BRAND_LABEL}
            </div>
            {event.items.length === 1 ? (
              <SingleEvent card={event.items[0]} kind={event.kind} past={past} />
            ) : (
              <FoldedEvent event={event} past={past} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 사건 1건 = 굿즈 1건. 상품명 링크 + 메타 */
function SingleEvent({ card, kind, past }: { card: Card; kind: ScheduleKind; past: boolean }) {
  const estimated = !past && kind !== 'restock' && card.timeEstimated;
  return (
    <>
      <div className="text-base leading-[1.4] font-semibold">
        <a
          href={card.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('no-underline hover:underline', past ? 'text-ended' : 'text-label')}
        >
          {card.title}
        </a>
      </div>
      {(card.acquisition === 'random' || estimated) && (
        <div
          className={cn(
            'mt-0.5 flex gap-x-2.5 text-sm',
            past ? 'text-label-tertiary' : 'text-label-secondary',
          )}
        >
          {card.acquisition === 'random' && <span>{formatSeriesTotal(card.seriesTotal)}</span>}
          {/* 지난 사건의 시각은 더 이상 문제가 아니다. 추정 표시는 오늘 이후에만 */}
          {estimated && (
            <span
              className="cursor-help underline decoration-dotted underline-offset-[3px]"
              title={TIME_ESTIMATED_TITLE}
            >
              {TIME_ESTIMATED_LABEL}
            </span>
          )}
        </div>
      )}
    </>
  );
}

/**
 * 접힌 사건 — 「発売 51点」 한 줄, 펼치면 굿즈 목록. 제목 판정은 `event-title.ts` (순수 함수).
 * 시각 추정 표시는 사건 전체에 한 번 — 한 발표의 개시 시각은 같다.
 */
function FoldedEvent({ event, past }: { event: CalendarEvent; past: boolean }) {
  const title = foldedEventTitle(event);
  const estimated =
    !past && event.kind !== 'restock' && event.items.some((card) => card.timeEstimated);

  return (
    <details className="group">
      <summary
        className={cn(
          '-my-1 flex min-h-11 cursor-pointer list-none items-center gap-1.5 py-1 marker:hidden [&::-webkit-details-marker]:hidden',
          past ? 'text-ended' : 'text-label',
        )}
      >
        <span className="text-base leading-[1.4] font-semibold">
          {title} <span className="tabular-nums">{formatCount(event.items.length)}</span>
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-label-tertiary transition-transform group-open:rotate-180 motion-reduce:transition-none"
          strokeWidth={2}
        />
        {estimated && (
          <span
            className="ml-1 cursor-help text-sm font-normal text-label-secondary underline decoration-dotted underline-offset-[3px]"
            title={TIME_ESTIMATED_TITLE}
          >
            {TIME_ESTIMATED_LABEL}
          </span>
        )}
      </summary>
      <ul className="mt-1 flex flex-col">
        {event.items.map((card) => {
          const price = formatPrice(card.price, card.priceVaries);
          return (
            <li key={card.id} className="flex items-baseline justify-between gap-3 py-1 text-sm">
              <a
                href={card.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'min-w-0 no-underline hover:underline',
                  past ? 'text-ended' : 'text-label',
                )}
              >
                {card.title}
                {card.acquisition === 'random' && (
                  <span className="ml-1.5 text-label-secondary">
                    {formatSeriesTotal(card.seriesTotal)}
                  </span>
                )}
              </a>
              {price !== null && (
                <span
                  className={cn(
                    'shrink-0 tabular-nums',
                    past ? 'text-label-tertiary' : 'text-label-secondary',
                  )}
                >
                  {price}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** 정렬된 배열을 키가 바뀔 때마다 끊는다. 순서를 보존한다 */
function groupConsecutive<T, K>(rows: readonly T[], keyOf: (row: T) => K): [K, T[]][] {
  const groups: [K, T[]][] = [];
  for (const row of rows) {
    const key = keyOf(row);
    const last = groups[groups.length - 1];
    if (last !== undefined && last[0] === key) last[1].push(row);
    else groups.push([key, [row]]);
  }
  return groups;
}
