import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CollectionRun } from '@/modules/collection-runs/entities/collection-run.entity';
import { HttpModule } from '@/modules/http/http.module';
import { MentionsModule } from '@/modules/mentions/mentions.module';
import { Source } from '@/modules/sources/entities/source.entity';
import { SourcesModule } from '@/modules/sources/sources.module';

import { ShopifyAdapter } from './adapters/shopify/shopify.adapter';
import { CollectService } from './collect.service';
import { SourceLockService } from './source-lock.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Source, CollectionRun]),
    HttpModule,
    SourcesModule,
    MentionsModule,
  ],
  providers: [ShopifyAdapter, SourceLockService, CollectService],
  exports: [CollectService],
})
export class CollectorsModule {}
