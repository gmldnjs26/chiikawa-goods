import { Module } from '@nestjs/common';

import { HttpFetcherService } from './http-fetcher.service';
import { RobotsService } from './robots.service';

/** 외부 요청은 전부 이 모듈을 거친다 (docs/data-collection-design.md §4.1) */
@Module({
  providers: [RobotsService, HttpFetcherService],
  exports: [HttpFetcherService],
})
export class HttpModule {}
