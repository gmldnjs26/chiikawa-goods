import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Brand } from '@/modules/brands/entities/brand.entity';
import { ItemMention } from '@/modules/item-mentions/entities/item-mention.entity';
import { Item } from '@/modules/items/entities/item.entity';
import { ItemCurrentSchedule } from '@/modules/scheduled-events/entities/item-current-schedule.view.entity';
import { StatusHistory } from '@/modules/status-histories/entities/status-history.entity';

import { CardAssemblerService } from './card-assembler.service';
import { CatalogService } from './catalog.service';

/**
 * 읽기 모델 (docs/read-api.md). 다른 도메인의 엔티티를 **읽기만** 한다 —
 * 여기서 쓰기가 시작되면 경계가 틀린 것이다 (be/CLAUDE.md §2).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Item, Brand, ItemMention, ItemCurrentSchedule, StatusHistory]),
  ],
  providers: [CatalogService, CardAssemblerService],
  exports: [CatalogService],
})
export class CatalogModule {}
