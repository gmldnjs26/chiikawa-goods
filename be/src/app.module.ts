import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HealthCommand } from './commands/health.command';
import { buildDataSourceOptions } from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    TypeOrmModule.forRoot(buildDataSourceOptions()),
  ],
  providers: [HealthCommand],
})
export class AppModule {}
