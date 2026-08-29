import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CollectCommand } from './batch/collect/collect.command';
import { HealthCommand } from './commands/health.command';
import { buildDataSourceOptions } from './config/database.config';
import { CollectorsModule } from './modules/collectors/collectors.module';
import { SourcesModule } from './modules/sources/sources.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    SourcesModule,
    CollectorsModule,
  ],
  providers: [HealthCommand, CollectCommand],
})
export class AppModule {}
