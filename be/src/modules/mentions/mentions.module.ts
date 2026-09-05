import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Mention } from './entities/mention.entity';
import { MentionsService } from './mentions.service';
import { PayloadPurgeService } from './payload-purge.service';

@Module({
  imports: [TypeOrmModule.forFeature([Mention])],
  providers: [MentionsService, PayloadPurgeService],
  exports: [MentionsService, PayloadPurgeService],
})
export class MentionsModule {}
