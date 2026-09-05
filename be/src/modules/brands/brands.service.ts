import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Brand } from './entities/brand.entity';
import { BrandCandidate, parseMatchRules } from './utils/match-rules';

/**
 * 브랜드 판정 후보를 읽어 둔다 (docs/db-schema.md §5.1).
 *
 * 규칙이 DB에 있는 이유는 배포 없이 고치기 위해서다. 한 번의 정규화 실행 안에서는
 * 같은 규칙을 써야 하므로 **실행 시작 시 한 번 읽는다.**
 *
 * 시드는 아직 없다 — 목록과 `match_rules`가 미결정이다 (§14 #2).
 * 후보가 0개면 전부 미판정이고, 화면에는 `その他`로 나온다.
 */
@Injectable()
export class BrandsService {
  private readonly logger = new Logger(BrandsService.name);

  constructor(@InjectRepository(Brand) private readonly brands: Repository<Brand>) {}

  async load(): Promise<BrandCandidate[]> {
    const rows = await this.brands.find({ order: { sortOrder: 'ASC', id: 'ASC' } });

    if (rows.length === 0) {
      this.logger.log('브랜드 후보가 없다. 전부 미판정으로 둔다 — 화면에는 その他로 나온다');
    }

    return rows.map((row) => ({
      id: row.id,
      sortOrder: row.sortOrder,
      rules: parseMatchRules(row.matchRules),
    }));
  }
}
