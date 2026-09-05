import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { type SourceConfig,sourceConfigSchema } from './dto/source-config.schema';
import { Source } from './entities/source.entity';

/** `config`까지 파싱이 끝난 소스. 수집 코드는 이 형태만 본다 */
export interface LoadedSource {
  readonly row: Source;
  readonly config: SourceConfig;
}

/**
 * 소스 레지스트리 (docs/data-collection-design.md §4).
 *
 * **잘못된 `config`는 수집 중이 아니라 로드 시점에 터진다.**
 * `config`는 DB 행에 있으니 "부팅 시점"이란 곧 여기서 행을 읽는 순간이다.
 * 어댑터 안에서 늦게 파싱하면 요건을 위반하면서 맞는 것처럼 보인다.
 */
@Injectable()
export class SourcesService implements OnModuleInit {
  private loaded: LoadedSource[] = [];

  constructor(
    @InjectRepository(Source)
    private readonly sources: Repository<Source>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  /** enabled 소스 전부를 파싱한다. 하나라도 깨지면 던진다 — 부분 로드는 하지 않는다 */
  async load(): Promise<LoadedSource[]> {
    const rows = await this.sources.find({ where: { enabled: true } });
    this.loaded = rows.map((row) => ({ row, config: parseConfig(row) }));
    return this.loaded;
  }

  /**
   * `enabled`와 무관하게 전부 읽는다.
   *
   * **`enabled`는 「외부 요청을 보낼 것인가」다.** 이미 DB에 있는 `mention`을 정규화하는 데는
   * 요청이 0건이므로 이 게이트가 걸릴 이유가 없다. 걸어 두면 ToS 문의 대기로
   * `enabled=false`인 3소스의 mention이 영영 `item`이 되지 못한다 — 화면을 만들 데이터가 없어진다.
   *
   * 공개 여부의 게이트는 여기가 아니라 [[plan]] §8.1이다.
   */
  async loadAll(): Promise<LoadedSource[]> {
    const rows = await this.sources.find();
    return rows.map((row) => ({ row, config: parseConfig(row) }));
  }

  all(): LoadedSource[] {
    return this.loaded;
  }

  byCode(code: string): LoadedSource {
    const found = this.loaded.find((entry) => entry.row.code === code);
    if (!found) throw new Error(`소스 ${code}가 없거나 enabled=false다`);
    return found;
  }
}

function parseConfig(row: Source): SourceConfig {
  const result = sourceConfigSchema.safeParse(row.config);
  if (!result.success) {
    // 어느 소스의 어느 필드가 왜 깨졌는지 남긴다. 수집 로그가 아니라 부팅 실패다
    throw new Error(
      `source.config가 스키마에 맞지 않는다 — code=${row.code}: ${JSON.stringify(result.error.issues)}`,
    );
  }
  return result.data;
}
