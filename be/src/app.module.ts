import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArchiveController } from './api/archive/archive.controller';
import { CalendarController } from './api/calendar/calendar.controller';
import { HomeController } from './api/home/home.controller';
import { CollectCommand } from './batch/collect/collect.command';
import { NormalizeCommand } from './batch/normalize/normalize.command';
import { PurgePayloadCommand } from './batch/purge/purge-payload.command';
import { HealthCommand } from './commands/health.command';
import { buildDataSourceOptions } from './config/database.config';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CollectorsModule } from './modules/collectors/collectors.module';
import { ItemsModule } from './modules/items/items.module';
import { MentionsModule } from './modules/mentions/mentions.module';
import { SourcesModule } from './modules/sources/sources.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    SourcesModule,
    CollectorsModule,
    MentionsModule,
    ItemsModule,
    CatalogModule,
  ],
  // 커맨드와 컨트롤러가 한 트리에 있다. 어느 쪽이 살아나는지는 main.ts의 첫 인자가 정한다 (be/CLAUDE.md §1)
  providers: [HealthCommand, CollectCommand, NormalizeCommand, PurgePayloadCommand],
  controllers: [HomeController, CalendarController, ArchiveController],
})
export class AppModule {}
