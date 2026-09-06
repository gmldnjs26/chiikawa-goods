import { Controller, Get, Query } from '@nestjs/common';

import { ZodValidationPipe } from '@/api/_common/zod-validation.pipe';
import { CatalogService } from '@/modules/catalog/catalog.service';
import type { ArchiveResponse } from '@/modules/catalog/dto/card.dto';

import { ArchiveQuery, archiveQuerySchema } from './dto/archive-query.schema';

/** docs/read-api.md §5. v0에서 페이지네이션이 있는 유일한 곳 */
@Controller('archive')
export class ArchiveController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  archive(
    @Query(new ZodValidationPipe(archiveQuerySchema)) query: ArchiveQuery,
  ): Promise<ArchiveResponse> {
    return this.catalog.archive(new Date(), query.limit, query.cursor);
  }
}
