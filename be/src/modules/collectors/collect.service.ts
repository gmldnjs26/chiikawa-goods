import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  CollectionRun,
  FailureKind,
} from '@/modules/collection-runs/entities/collection-run.entity';
import { CollectError } from '@/modules/http/http.errors';
import { MentionStoreService } from '@/modules/mentions/mention-store.service';
import { Source } from '@/modules/sources/entities/source.entity';
import { LoadedSource, SourceRegistryService } from '@/modules/sources/source-registry.service';

import { ShopifyAdapter } from './adapters/shopify/shopify.adapter';
import { CollectorAdapter } from './collector.contract';
import { SourceLockService } from './source-lock.service';

/**
 * 수집 실행 (docs/data-collection-design.md §4 · §6.2).
 *
 * **소스 단위 실패 격리** — 1개가 실패해도 나머지는 돈다. 그래서 여기서 예외를 잡는다.
 * 어댑터는 던지고, 판단은 여기서 한다.
 */
@Injectable()
export class CollectService {
  private readonly logger = new Logger(CollectService.name);
  private readonly adapters: CollectorAdapter[];

  constructor(
    private readonly registry: SourceRegistryService,
    private readonly lock: SourceLockService,
    private readonly store: MentionStoreService,
    @InjectRepository(Source) private readonly sources: Repository<Source>,
    @InjectRepository(CollectionRun) private readonly runs: Repository<CollectionRun>,
    shopify: ShopifyAdapter,
  ) {
    this.adapters = [shopify];
  }

  /** `codes`가 비면 enabled 소스 전부 */
  async collectAll(codes: string[]): Promise<void> {
    const loaded = await this.registry.load();
    const targets =
      codes.length === 0 ? loaded : loaded.filter((source) => codes.includes(source.row.code));

    const unknown = codes.filter((code) => !loaded.some((source) => source.row.code === code));
    if (unknown.length > 0) throw new Error(`모르는 소스다: ${unknown.join(', ')}`);

    for (const source of targets) {
      // 여기서 삼킨다. 1개 실패가 전체를 막지 않는다
      await this.collectOne(source);
    }
  }

  private async collectOne(source: LoadedSource): Promise<void> {
    const { row, config } = source;
    const lastSuccess = await this.lastSuccessAt(row.id);

    // 락은 **동시 실행**만 막는다. 앞 실행이 끝났으면 락은 열려 있고,
    // 스케줄러가 1분마다 때리면 1분마다 수집한다. 주기는 여기서 지킨다
    if (this.isTooSoon(lastSuccess, row.intervalSec)) {
      await this.runs.save(
        this.runs.create({ sourceId: row.id, status: 'skipped_idle', finishedAt: new Date() }),
      );
      this.logger.log(`${row.code}: ${row.intervalSec}초가 안 지났다. 요청 없이 끝낸다`);
      return;
    }

    const runner = await this.lock.acquire(row.id);

    if (runner === null) {
      // 자주 나오면 폴링 주기가 수집 시간보다 짧다는 신호다
      await this.runs.save(
        this.runs.create({ sourceId: row.id, status: 'skipped_locked', finishedAt: new Date() }),
      );
      return;
    }

    const run = await this.runs.save(this.runs.create({ sourceId: row.id, status: 'running' }));

    try {
      const adapter = this.adapterFor(row.platform);
      const collected = await adapter.collect({
        sourceId: row.id,
        baseUrl: row.baseUrl,
        config,
        since: lastSuccess,
        crawlDelaySec: row.crawlDelaySec,
      });

      const stored = await this.store.store(row.id, run.id, collected, config.hash_exclude);

      await this.runs.update(run.id, {
        status: 'success',
        finishedAt: new Date(),
        mentionCount: stored.total,
        newCount: stored.created,
        excludedCount: stored.excluded,
      });
      this.logger.log(`${row.code}: 성공 — 신규 ${stored.created}건`);
    } catch (error) {
      await this.recordFailure(run.id, row, error);
    } finally {
      await this.lock.release(runner, row.id);
    }
  }

  private async recordFailure(runId: string, row: Source, error: unknown): Promise<void> {
    const collectError = error instanceof CollectError ? error : null;
    const failureKind: FailureKind = collectError?.failureKind ?? 'parse';
    const message = error instanceof Error ? error.message : String(error);

    await this.runs.update(runId, {
      status: 'failed',
      finishedAt: new Date(),
      failureKind,
      httpStatus: collectError?.httpStatus ?? null,
      errorMessage: message.slice(0, 2000),
    });

    // 차단당했으면 스스로 내린다 (§4.1). 계속 두드리면 그 소스를 영구히 잃는다.
    // robots.txt가 막은 경로는 여기 해당하지 않는다 — 상대가 우리를 막은 게 아니다
    if (collectError?.shouldDisableSource === true) {
      await this.sources.update(row.id, { enabled: false, disabledReason: message.slice(0, 500) });
      this.logger.error(`${row.code}: 차단 신호로 소스를 내렸다 — ${message}`);
      return;
    }

    this.logger.error(`${row.code}: 실패(${failureKind}) — ${message}`);
  }

  /** 마지막 성공에서 `interval_sec`이 안 지났으면 외부 요청 없이 끝낸다 */
  private isTooSoon(lastSuccess: Date | null, intervalSec: number): boolean {
    if (lastSuccess === null) return false;
    return Date.now() - lastSuccess.getTime() < intervalSec * 1000;
  }

  /** `source.last_success_at`을 두지 않는다 — `collection_run`에서 파생되는 값이다 */
  private async lastSuccessAt(sourceId: string): Promise<Date | null> {
    const last = await this.runs.findOne({
      where: { sourceId, status: 'success' },
      order: { startedAt: 'DESC' },
    });
    return last?.finishedAt ?? null;
  }

  private adapterFor(platform: string): CollectorAdapter {
    const adapter = this.adapters.find((candidate) => candidate.platform === platform);
    if (adapter === undefined) throw new Error(`어댑터가 없다: platform=${platform}`);
    return adapter;
  }
}
