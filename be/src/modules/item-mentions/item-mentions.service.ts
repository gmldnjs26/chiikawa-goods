import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ItemMention } from './entities/item-mention.entity';

/**
 * `item` ↔ `mention` 연결 (docs/db-schema.md §7).
 *
 * 관계 자체가 도메인이다 — `items/`도 `mentions/`도 상대를 알 이유가 없고,
 * 양쪽을 아는 것은 이 모듈뿐이다 (be/CLAUDE.md §2).
 */
@Injectable()
export class ItemMentionsService {
  constructor(@InjectRepository(ItemMention) private readonly links: Repository<ItemMention>) {}

  /**
   * 같은 짝을 두 번 넣지 않는다. 재실행이 안전해야 한다.
   *
   * `primary`는 공식 링크의 출처 **1개**다. 같은 상품의 mention이 내용 변경마다 쌓이므로
   * 매번 `primary`로 넣으면 N개가 된다 — 첫 연결만 `primary`, 이후는 `evidence`.
   */
  async link(itemId: string, mentionId: string): Promise<void> {
    const hasPrimary = await this.links.exists({ where: { itemId, role: 'primary' } });

    await this.links
      .createQueryBuilder()
      .insert()
      .values({ itemId, mentionId, role: hasPrimary ? 'evidence' : 'primary', linkedBy: 'auto' })
      .orIgnore()
      .execute();
  }
}
