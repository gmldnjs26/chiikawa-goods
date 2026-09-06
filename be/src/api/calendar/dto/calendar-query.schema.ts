import { z } from 'zod';

import { daysBetween, isCalendarDate } from '@/modules/_common/jst-date';

/** docs/read-api.md §4. 폭 상한 — 한 달 화면에 두 달치까지 */
export const CALENDAR_MAX_SPAN_DAYS = 62;

const calendarDate = z
  .string()
  .refine(isCalendarDate, { message: 'YYYY-MM-DD 형식의 실재하는 날짜여야 한다' });

/**
 * `from` · `to`는 **둘 다 있거나 둘 다 없다.** 하나만 오면 나머지를 추측하지 않는다.
 * 둘 다 없으면 `today`가 속한 달 — 그 기본값은 요청 시각이 필요하므로 컨트롤러가 채운다.
 */
export const calendarQuerySchema = z
  .object({ from: calendarDate.optional(), to: calendarDate.optional() })
  .superRefine((query, ctx) => {
    if ((query.from === undefined) !== (query.to === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'from과 to는 함께 준다', path: ['from'] });
      return;
    }
    if (query.from === undefined || query.to === undefined) return;

    const span = daysBetween(query.from, query.to);
    if (span < 0) ctx.addIssue({ code: 'custom', message: 'from이 to보다 뒤다', path: ['to'] });
    if (span > CALENDAR_MAX_SPAN_DAYS) {
      ctx.addIssue({
        code: 'custom',
        message: `to − from은 ${CALENDAR_MAX_SPAN_DAYS}일 이하여야 한다`,
        path: ['to'],
      });
    }
  });

export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
