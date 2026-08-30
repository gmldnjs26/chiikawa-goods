import { Module } from '@nestjs/common';

import { FetcherService } from './fetcher.service';
import { HttpTransportService } from './http-transport.service';
import { RobotsService } from './robots.service';

/**
 * 외부 요청은 전부 이 모듈을 거친다 (docs/data-collection-design.md §4.1).
 *
 * 이름을 `FetcherModule`로 두지 않는다 — `@nestjs/axios`가 같은 이름을 쓴다.
 */
@Module({
  providers: [HttpTransportService, RobotsService, FetcherService],
  exports: [FetcherService],
})
export class FetcherModule {}
