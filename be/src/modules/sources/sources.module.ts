import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Source } from './entities/source.entity';
import { SourceRegistryService } from './source-registry.service';

/** 소스 레지스트리. `config` 검증이 여기서 끝난다 */
@Module({
  imports: [TypeOrmModule.forFeature([Source])],
  providers: [SourceRegistryService],
  exports: [SourceRegistryService],
})
export class SourcesModule {}
