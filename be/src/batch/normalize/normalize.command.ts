import { Command, CommandRunner, Option } from 'nest-commander';

import { ItemPromoteService } from '@/modules/items/item-promote.service';

interface NormalizeOptions {
  source?: string;
}

/**
 * `npm run cli normalize -- --source=chiikawamarket`
 *
 * 수집과 분리된 커맨드다. **`mention`을 고치지 않으므로 몇 번을 돌려도 같은 결과다** —
 * 정규화 규칙을 고치면 다시 돌려서 `item`을 다시 만든다.
 */
@Command({ name: 'normalize', description: 'mention을 item으로 승격한다' })
export class NormalizeCommand extends CommandRunner {
  constructor(private readonly promote: ItemPromoteService) {
    super();
  }

  async run(_args: string[], options: NormalizeOptions): Promise<void> {
    const codes = options.source?.split(',').filter((code) => code.length > 0) ?? [];
    await this.promote.promoteAll(codes);
  }

  @Option({
    flags: '-s, --source <codes>',
    description: '소스 code. 쉼표로 여러 개. 없으면 전부 — 정규화는 외부 요청이 0건이라 enabled를 보지 않는다',
  })
  parseSource(value: string): string {
    return value;
  }
}
