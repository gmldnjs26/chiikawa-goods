import { notFound } from 'next/navigation';

import { fetchCalendar } from '@/lib/api';
import { CalendarList } from '@/modules/calendar/components/CalendarList';
import { MonthNav } from '@/modules/calendar/components/MonthNav';
import { monthBounds, monthOf, parseMonth } from '@/modules/calendar/month';

/**
 * 캘린더 — 사건 단위 (docs/plan.md §6.4). `?month=YYYY-MM`, 없으면 API 기본값(이번 달).
 * 깨진 `month`는 404다. 조용히 이번 달로 돌리지 않는다 — 경계에서 형식 위반은 드러낸다.
 */
export default async function CalendarPage({ searchParams }: PageProps<'/calendar'>) {
  const { month: rawMonth } = await searchParams;
  const value = Array.isArray(rawMonth) ? rawMonth[0] : rawMonth;
  const month = parseMonth(value);
  if (value !== undefined && month === null) notFound();
  const bounds = month === null ? undefined : monthBounds(month);
  const calendar = await fetchCalendar(bounds?.from, bounds?.to);

  return (
    <div className="-mx-4">
      <div className="px-4">
        <MonthNav month={monthOf(calendar.from)} />
        <p className="text-xs leading-normal text-label-secondary">
          日付が確定した予定のみ。時期のみの告知はホームに表示します。
        </p>
      </div>
      <div className="mt-3">
        <CalendarList events={calendar.events} today={calendar.today} />
      </div>
    </div>
  );
}
