import { Command, CommandRunner, Option } from 'nest-commander';

import { CollectorsService } from '@/modules/collectors/collectors.service';

interface CollectOptions {
  source?: string;
}

/**
 * `npm run cli collect -- --source=chiikawamarket`
 *
 * 배치는 **언제·어떻게 돌리는가**를 맡는다 — 무엇을 긁는가는 어댑터다.
 * 커맨드는 반드시 끝나야 한다. 안 끝나면 Job 과금이 멈추지 않는다.
 */
@Command({ name: 'collect', description: '소스를 수집해 mention을 만든다' })
export class CollectCommand extends CommandRunner {
  constructor(private readonly collect: CollectorsService) {
    super();
  }

  async run(_args: string[], options: CollectOptions): Promise<void> {
    const codes = options.source?.split(',').filter((code) => code.length > 0) ?? [];
    await this.collect.collectAll(codes);
  }

  @Option({
    flags: '-s, --source <codes>',
    description: '소스 code. 쉼표로 여러 개. 없으면 enabled 전부',
  })
  parseSource(value: string): string {
    return value;
  }
}
