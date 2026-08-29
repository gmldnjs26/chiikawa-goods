import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Mention } from './entities/mention.entity';

/** docs/data-collection-design.md §10.1. v0 운용 1개월 후 실측 증가율로 조정한다 */
export const DEFAULT_RETENTION_DAYS = 90;

/**
 * `raw_payload` 보존 상한 (docs/tech-stack.md §2.7 · §4.2).
 *
 * **`mention` 행 자체는 영구다.** 지우는 것은 본문뿐이고 `payload_purged_at`을 남긴다 —
 * "본문이 없다"와 "원래 안 받았다"를 구별할 수 있어야 한다.
 *
 * 첫 커밋에 넣는 이유: `disk_autoresize`는 한 번 늘면 **줄지 않는다.**
 * 크레딧 기간을 무제한 보존으로 돌리면 재판단 시점에 이전 출구가 막힌다.
 */
@Injectable()
export class PayloadPurgeService {
  private readonly logger = new Logger(PayloadPurgeService.name);

  constructor(@InjectRepository(Mention) private readonly mentions: Repository<Mention>) {}

  async purge(retentionDays: number, now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const result = await this.mentions
      .createQueryBuilder()
      .update()
      .set({ rawPayload: null, payloadPurgedAt: now })
      .where('observed_at < :cutoff', { cutoff })
      // 이미 지운 행을 다시 훑지 않는다. 부분 인덱스가 이 조건에 걸려 있다
      .andWhere('raw_payload IS NOT NULL')
      .execute();

    const affected = result.affected ?? 0;
    this.logger.log(`${cutoff.toISOString()} 이전 본문 ${affected}건을 지웠다. 행은 남는다`);
    return affected;
  }
}
