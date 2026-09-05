import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ItemMention } from './entities/item-mention.entity';
import { ItemMentionsService } from './item-mentions.service';

@Module({
  imports: [TypeOrmModule.forFeature([ItemMention])],
  providers: [ItemMentionsService],
  exports: [ItemMentionsService],
})
export class ItemMentionsModule {}
