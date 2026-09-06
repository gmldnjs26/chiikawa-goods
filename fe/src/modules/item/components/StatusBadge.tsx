import { cn } from '@/lib/cn';

import type { Badge } from '../badge';

/**
 * 뱃지 8종 (디자인 플랜 v1). 색 + 마커 + 텍스트를 항상 같이 낸다 — 색 단독으로 정보를 주지 않는다.
 * 「점선 = 아직 모르는 것」: 再入荷未定은 점선 테두리 + 점선 링, 9月下旬은 빈 도트.
 * 再入荷(방금)는 판매중 계열의 유일한 채움 뱃지.
 */
export function StatusBadge({ badge }: { badge: Badge }) {
  const base =
    'inline-flex shrink-0 items-center gap-1.25 rounded-md px-[7px] py-0.5 text-xs font-semibold whitespace-nowrap';
  switch (badge.kind) {
    case 'on-sale':
      return (
        <span className={cn(base, 'bg-on-sale/8 text-on-sale')}>
          <Dot className="bg-on-sale" />
          {badge.label}
        </span>
      );
    case 'restocked':
      return (
        <span className={cn(base, 'bg-on-sale text-background')}>
          <Dot className="bg-background" />
          {badge.label}
        </span>
      );
    case 'upcoming':
      return <span className={cn(base, 'bg-upcoming/8 text-upcoming')}>{badge.label}</span>;
    case 'restock-dated':
      return (
        <span className={cn(base, 'bg-restock/8 text-restock')}>
          <Dot className="bg-restock" />
          {badge.label}
        </span>
      );
    case 'restock-text':
      // 시기만 아는 것 — 채움이 아니라 빈 도트. 날짜 확정보다 한 단계 약하게
      return (
        <span className={cn(base, 'bg-restock/8 text-restock/85')}>
          <Dot className="border-[1.5px] border-restock" />
          {badge.label}
        </span>
      );
    case 'restock-undecided':
      return (
        <span
          className={cn(
            base,
            'border border-dashed border-label-tertiary py-px text-label-secondary',
          )}
        >
          <Dot className="border-[1.5px] border-dashed border-label-secondary" />
          {badge.label}
        </span>
      );
    case 'sold-out':
      return (
        <span className={cn(base, 'bg-fill text-label-secondary')}>
          <Dot className="bg-ended" />
          {badge.label}
        </span>
      );
    case 'unknown':
      return (
        <span
          className={cn(base, 'border border-upcoming py-px text-upcoming')}
          title={badge.reason}
        >
          <span
            aria-hidden
            className="inline-block size-0 border-x-4 border-b-[7px] border-x-transparent border-b-upcoming"
          />
          {badge.label}
        </span>
      );
  }
}

function Dot({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('inline-block size-1.5 shrink-0 rounded-full', className)} />
  );
}

/** 카드 왼쪽 2px 레일. 뱃지와 같은 문법 — 이중 표기 */
export function railClass(badge: Badge): string {
  switch (badge.kind) {
    case 'on-sale':
    case 'restocked':
      return 'border-l-2 border-on-sale';
    case 'upcoming':
    case 'unknown':
      return 'border-l-2 border-upcoming';
    case 'restock-dated':
    case 'restock-text':
      return 'border-l-2 border-restock';
    case 'restock-undecided':
      return 'border-l-2 border-dashed border-label-tertiary';
    case 'sold-out':
      return 'border-l-2 border-border';
  }
}
