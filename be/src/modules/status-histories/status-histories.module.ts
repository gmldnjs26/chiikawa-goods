import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StatusHistory } from './entities/status-history.entity';
import { StatusHistoriesService } from './status-histories.service';

@Module({
  imports: [TypeOrmModule.forFeature([StatusHistory])],
  providers: [StatusHistoriesService],
  exports: [StatusHistoriesService],
})
export class StatusHistoriesModule {}
