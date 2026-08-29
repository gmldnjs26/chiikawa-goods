import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Mention } from './entities/mention.entity';
import { MentionStoreService } from './mention-store.service';
import { PayloadPurgeService } from './payload-purge.service';

@Module({
  imports: [TypeOrmModule.forFeature([Mention])],
  providers: [MentionStoreService, PayloadPurgeService],
  exports: [MentionStoreService, PayloadPurgeService],
})
export class MentionsModule {}
