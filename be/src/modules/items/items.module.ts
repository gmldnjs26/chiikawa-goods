import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BrandsModule } from '@/modules/brands/brands.module';
import { DropGroup } from '@/modules/drop-groups/entities/drop-group.entity';
import { Mention } from '@/modules/mentions/entities/mention.entity';
import { SourcesModule } from '@/modules/sources/sources.module';

import { Item } from './entities/item.entity';
import { ItemMention } from './entities/item-mention.entity';
import { ItemPromoteService } from './item-promote.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, ItemMention, DropGroup, Mention]),
    SourcesModule,
    BrandsModule,
  ],
  providers: [ItemPromoteService],
  exports: [ItemPromoteService],
})
export class ItemsModule {}
