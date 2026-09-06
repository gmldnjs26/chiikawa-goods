import { Controller, Get, Query } from '@nestjs/common';

import { ZodValidationPipe } from '@/api/_common/zod-validation.pipe';
import { monthBounds, toJstCalendarDate } from '@/modules/_common/jst-date';
import { CatalogService } from '@/modules/catalog/catalog.service';
import type { CalendarResponse } from '@/modules/catalog/dto/card.dto';

import { CalendarQuery, calendarQuerySchema } from './dto/calendar-query.schema';

/** docs/read-api.md §4. 굿즈가 아니라 사건을 돌려준다 */
@Controller('calendar')
export class CalendarController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  calendar(
    @Query(new ZodValidationPipe(calendarQuerySchema)) query: CalendarQuery,
  ): Promise<CalendarResponse> {
    const now = new Date();
    const range =
      query.from !== undefined && query.to !== undefined
        ? { from: query.from, to: query.to }
        : monthBounds(toJstCalendarDate(now));
    return this.catalog.calendar(now, range.from, range.to);
  }
}
