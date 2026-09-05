import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BrandsModule } from '@/modules/brands/brands.module';
import { DropGroup } from '@/modules/drop-groups/entities/drop-group.entity';
import { ItemMentionsModule } from '@/modules/item-mentions/item-mentions.module';
import { Mention } from '@/modules/mentions/entities/mention.entity';
import { SourcesModule } from '@/modules/sources/sources.module';

import { Item } from './entities/item.entity';
import { ItemsService } from './items.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Item, DropGroup, Mention]),
    SourcesModule,
    BrandsModule,
    ItemMentionsModule,
  ],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
