import Link from 'next/link';

import { formatMonth, shiftMonth } from '../month';

/** 달 이동. 링크다 — 서버 컴포넌트가 새 `month`로 다시 그린다. 클라이언트 상태가 없다. 탭 44×44 */
export function MonthNav({ month }: { month: string }) {
  const linkClass = 'flex size-11 items-center justify-center text-[22px] no-underline';
  return (
    <div className="-mx-2 flex items-center justify-between">
      <Link
        href={`/calendar?month=${shiftMonth(month, -1)}`}
        className={linkClass}
        rel="prev"
        aria-label="前月"
      >
        ‹
      </Link>
      <h2 className="text-xl font-semibold">{formatMonth(month)}</h2>
      <Link
        href={`/calendar?month=${shiftMonth(month, 1)}`}
        className={linkClass}
        rel="next"
        aria-label="翌月"
      >
        ›
      </Link>
    </div>
  );
}
