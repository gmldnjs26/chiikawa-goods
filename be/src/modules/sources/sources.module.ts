import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Source } from './entities/source.entity';
import { SourcesService } from './sources.service';

/** 소스 레지스트리. `config` 검증이 여기서 끝난다 */
@Module({
  imports: [TypeOrmModule.forFeature([Source])],
  providers: [SourcesService],
  exports: [SourcesService],
})
export class SourcesModule {}
