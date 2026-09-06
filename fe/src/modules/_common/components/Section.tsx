import { Archive, CalendarClock, type LucideIcon, PackageOpen, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

export type Tone = 'on-sale' | 'upcoming' | 'restock' | 'ended';

/** 섹션 마커 — 상태색 아이콘 (lucide). 색은 상태색 4개에 고정, 아이콘은 「유저가 할 일」을 말한다 */
const ICON: Record<Tone, LucideIcon> = {
  'on-sale': ShoppingBag, // 지금 산다
  upcoming: CalendarClock, // 날짜를 기다린다
  restock: PackageOpen, // 재입고를 기다린다
  ended: Archive, // 끝났다
};
const TEXT: Record<Tone, string> = {
  'on-sale': 'text-on-sale',
  upcoming: 'text-upcoming',
  restock: 'text-restock',
  ended: 'text-ended',
};

export function SectionIcon({ tone, className }: { tone: Tone; className?: string }) {
  const Icon = ICON[tone];
  return (
    <Icon aria-hidden className={cn('size-5 shrink-0', TEXT[tone], className)} strokeWidth={2} />
  );
}

/** 빈 상태 마커 — 점선 링 도트. 「아직 모르는 것」 문법 */
export function DashedDot() {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full border-[1.5px] border-dashed border-label-tertiary"
    />
  );
}

/**
 * 섹션 헤더 — 도트 · 제목(20/600) · 건수 · 오른쪽 `すべて ›`.
 * `href`가 있으면 헤더 행 전체(44pt)가 링크다.
 */
export function SectionHeader({
  tone,
  title,
  count,
  href,
  note,
}: {
  tone: Tone;
  title: string;
  count?: number;
  href?: string;
  note?: React.ReactNode;
}) {
  const row = (
    <>
      <SectionIcon tone={tone} />
      <h2 className="text-xl leading-tight font-semibold">{title}</h2>
      {count !== undefined && (
        <span className="text-sm text-label-secondary" aria-label={`${count}件`}>
          {count}
        </span>
      )}
      {href && (
        <span className="ml-auto flex items-center gap-1 text-sm text-label-secondary">
          すべて <span className="text-lg leading-none">›</span>
        </span>
      )}
    </>
  );
  const rowClass = '-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-label';
  return (
    <div>
      {href ? (
        <Link href={href} className={cn(rowClass, 'no-underline hover:bg-fill')}>
          {row}
        </Link>
      ) : (
        <div className={rowClass}>{row}</div>
      )}
      {note && <p className="mt-1 text-xs leading-normal text-label-secondary">{note}</p>}
    </div>
  );
}

/** 그룹 컨테이너. 카드는 개별 상자가 아니라 이 안의 한 행이다 */
export function GroupedList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('overflow-hidden rounded-lg bg-surface', className)}>{children}</div>;
}

/** 행 사이 구분선. 레일 폭(14px)만큼 들여쓴다 */
export function RowDivider() {
  return <div className="ml-3.5 h-px bg-separator" aria-hidden />;
}

/** 빈 상태 — 점선 링 도트 + 1줄 + 선택적 행동 */
export function EmptyState({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-surface px-4 py-8">
      <DashedDot />
      <p className="text-sm text-label-secondary">{children}</p>
      {action}
    </div>
  );
}
