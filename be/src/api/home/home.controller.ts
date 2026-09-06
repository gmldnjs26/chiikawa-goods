import { Controller, Get } from '@nestjs/common';

import { CatalogService } from '@/modules/catalog/catalog.service';
import type { HomeResponse } from '@/modules/catalog/dto/card.dto';

/** docs/read-api.md §3. 필터는 응답에 없다 — 화면의 로컬 상태다 (§3.3) */
@Controller('home')
export class HomeController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  home(): Promise<HomeResponse> {
    return this.catalog.home(new Date());
  }
}
