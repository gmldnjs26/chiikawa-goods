import { cn } from '@/lib/cn';

import { UNKNOWN_BRAND_LABEL, UNKNOWN_SERIES_LABEL } from '../consts';

/**
 * 브랜드 칩 — 테두리만. null은 `その他`로 **보여준다** (docs/plan.md §6.6).
 * 미판정은 점선 테두리 — 「점선 = 아직 모르는 것」 문법.
 */
export function BrandChip({
  brand,
  muted = false,
}: {
  brand: { label: string } | null;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 text-xs leading-5 whitespace-nowrap',
        brand === null ? 'border border-dashed' : 'border',
        muted
          ? 'border-separator text-label-tertiary'
          : brand === null
            ? 'border-label-tertiary text-label-secondary'
            : 'border-border text-label-secondary',
      )}
    >
      {brand === null ? UNKNOWN_BRAND_LABEL : brand.label}
    </span>
  );
}

/**
 * 시리즈 칩 (`映画ちいかわ`) — 무채 테두리, 브랜드 칩과 같은 급 (디자인 플랜 7c). 색을 주지 않는다.
 * null은 「시리즈 없음」 = `その他`, 점선 — 「아직 모르는 것」 문법.
 */
export function SeriesChip({ series, muted = false }: { series: string | null; muted?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 text-xs leading-5 whitespace-nowrap',
        series === null ? 'border border-dashed' : 'border',
        muted
          ? 'border-separator text-label-tertiary'
          : series === null
            ? 'border-label-tertiary text-label-secondary'
            : 'border-border text-label',
      )}
    >
      {series ?? UNKNOWN_SERIES_LABEL}
    </span>
  );
}

/** 정보 칩 (`川越店限定`). 브랜드 칩보다 한 급 아래 — 채움, 테두리 없음 */
export function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 text-xs leading-5 whitespace-nowrap bg-fill">
      {children}
    </span>
  );
}

/** `全N種` — 상품명 옆 굵은 테두리 라벨. 색은 안 쓰고 굵기 + 테두리로만 강조 */
export function SeriesLabel({ children, muted = false }: { children: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        'ml-1 inline-block rounded border-[1.5px] px-1.25 align-[2px] text-xs leading-[18px] font-normal whitespace-nowrap',
        muted ? 'border-label-quaternary text-ended' : 'border-label text-label',
      )}
    >
      {children}
    </span>
  );
}
