import { Command, CommandRunner, Option } from 'nest-commander';

import {
  DEFAULT_RETENTION_DAYS,
  PayloadPurgeService,
} from '@/modules/mentions/payload-purge.service';

interface PurgeOptions {
  days?: number;
}

/**
 * `npm run cli purge-payload -- --days=90`
 *
 * `mention` 행은 지우지 않는다. 본문만 비운다 (docs/data-collection-design.md §10.1).
 */
@Command({ name: 'purge-payload', description: '보존 기간이 지난 raw_payload를 비운다' })
export class PurgePayloadCommand extends CommandRunner {
  constructor(private readonly purge: PayloadPurgeService) {
    super();
  }

  async run(_args: string[], options: PurgeOptions): Promise<void> {
    await this.purge.purge(options.days ?? DEFAULT_RETENTION_DAYS, new Date());
  }

  @Option({ flags: '-d, --days <days>', description: `보존 일수 (기본 ${DEFAULT_RETENTION_DAYS})` })
  parseDays(value: string): number {
    const days = Number(value);
    if (!Number.isInteger(days) || days <= 0) throw new Error('--days는 양의 정수다');
    return days;
  }
}
