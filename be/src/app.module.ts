import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CollectCommand } from './batch/collect/collect.command';
import { NormalizeCommand } from './batch/normalize/normalize.command';
import { PurgePayloadCommand } from './batch/purge/purge-payload.command';
import { HealthCommand } from './commands/health.command';
import { buildDataSourceOptions } from './config/database.config';
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
  ],
  providers: [HealthCommand, CollectCommand, NormalizeCommand, PurgePayloadCommand],
})
export class AppModule {}
