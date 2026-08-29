import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Mention } from './entities/mention.entity';
import { MentionStoreService } from './mention-store.service';

@Module({
  imports: [TypeOrmModule.forFeature([Mention])],
  providers: [MentionStoreService],
  exports: [MentionStoreService],
})
export class MentionsModule {}
