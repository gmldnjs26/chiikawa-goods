import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ScheduledEvent } from './entities/scheduled-event.entity';
import { ScheduledEventsService } from './scheduled-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduledEvent])],
  providers: [ScheduledEventsService],
  exports: [ScheduledEventsService],
})
export class ScheduledEventsModule {}
