import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import type { CollectedMention } from '@/modules/collectors/collector.contract';

import { Mention } from './entities/mention.entity';
import { payloadHash } from './payload-hash';

export interface StoreResult {
  readonly total: number;
  readonly created: number;
  readonly excluded: number;
}

/**
 * `mention` 저장 (docs/data-collection-design.md §10.1).
 *
 * **내용 해시가 같으면 저장하지 않는다.** 30분 폴링은 대부분 무변경이라
 * 이것 하나로 증가량이 크게 준다. `disk_autoresize`는 한 번 늘면 줄지 않으므로
 * 이 판정 없이 도는 실행이 하루라도 있으면 안 된다 (docs/tech-stack.md §4.2).
 */
@Injectable()
export class MentionStoreService {
  private readonly logger = new Logger(MentionStoreService.name);

  constructor(@InjectRepository(Mention) private readonly mentions: Repository<Mention>) {}

  async store(
    sourceId: string,
    collectionRunId: string,
    collected: CollectedMention[],
    hashExclude: readonly string[],
  ): Promise<StoreResult> {
    let created = 0;

    for (const mention of collected) {
      const hash = payloadHash(mention.rawPayload, hashExclude);

      // UNIQUE (source_id, external_id, payload_hash). 무변경이면 여기서 끝난다
      const result = await this.mentions
        .createQueryBuilder()
        .insert()
        .values({
          sourceId,
          collectionRunId,
          externalId: mention.externalId,
          url: mention.url,
          rawTitle: mention.rawTitle,
          // jsonb 컬럼. QueryDeepPartialEntity가 객체를 부분 엔티티로 보려 해서 캐스팅한다.
          // 값 자체는 드라이버가 파라미터로 넘긴다 — SQL에 문자열로 끼워 넣지 않는다
          rawPayload: mention.rawPayload as Mention['rawPayload'] & object,
          payloadHash: hash,
          relevance: mention.relevance,
        })
        .orIgnore()
        // ON CONFLICT DO NOTHING이면 `identifiers`는 건너뛴 행도 채운다.
        // 실제로 들어갔는지는 RETURNING이 준 행 수로만 안다
        .returning('id')
        .execute();

      if ((result.raw as unknown[]).length > 0) created += 1;
    }

    const excluded = collected.filter((mention) => mention.relevance === 'excluded').length;
    this.logger.log(`관측 ${collected.length}건 · 신규 ${created}건 · 제외 ${excluded}건`);

    return { total: collected.length, created, excluded };
  }
}
