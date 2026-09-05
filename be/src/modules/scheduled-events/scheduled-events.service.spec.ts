import type { Repository } from 'typeorm';

import type { ScheduledEvent } from './entities/scheduled-event.entity';
import { ScheduledEventsService } from './scheduled-events.service';
import type { ScheduleContent } from './utils/schedule-from-tags';

/**
 * supersede 규칙의 대상은 행 몇 개짜리 배열이다. 진짜 DB 없이 규칙만 검증한다 —
 * `find` / `update` / `insert` 3개만 흉내 낸다.
 */
class FakeRepository {
  rows: ScheduledEvent[] = [];
  private nextId = 1;

  find(options: { where: { itemId: string; kind: string } }): Promise<ScheduledEvent[]> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.itemId === options.where.itemId && row.kind === options.where.kind)
        .sort(
          (a, b) => a.observedAt.getTime() - b.observedAt.getTime() || Number(a.id) - Number(b.id),
        ),
    );
  }

  update(ids: string[], patch: { supersededAt: Date }): Promise<void> {
    for (const row of this.rows) if (ids.includes(row.id)) row.supersededAt = patch.supersededAt;
    return Promise.resolve();
  }

  insert(values: Omit<ScheduledEvent, 'id' | 'supersededAt' | 'createdAt' | 'item' | 'mention'>) {
    this.rows.push({
      ...values,
      id: String(this.nextId++),
      supersededAt: null,
      createdAt: new Date(),
    } as ScheduledEvent);
    return Promise.resolve();
  }
}

const at = (iso: string): Date => new Date(iso);
const on = (date: string): ScheduleContent => ({
  scheduledOn: date,
  scheduledText: null,
  undecided: false,
});

function setup() {
  const repo = new FakeRepository();
  const service = new ScheduledEventsService(repo as unknown as Repository<ScheduledEvent>);
  const reconcile = (observedAt: string, desired: ScheduleContent | null, mentionId = observedAt) =>
    service.reconcile({
      itemId: '1',
      kind: 'preorder',
      desired,
      observedAt: at(observedAt),
      mentionId,
    });
  const current = () => repo.rows.filter((row) => row.supersededAt === null);
  return { repo, reconcile, current };
}

describe('ScheduledEventsService.reconcile', () => {
  it('첫 예정은 새 행이다', async () => {
    const { reconcile, current } = setup();

    expect(await reconcile('2026-08-01T00:00:00Z', on('2026-08-20'))).toBe('created');
    expect(current()).toHaveLength(1);
  });

  it('같은 내용은 행을 늘리지 않는다', async () => {
    const { reconcile, repo } = setup();
    await reconcile('2026-08-01T00:00:00Z', on('2026-08-20'));

    expect(await reconcile('2026-08-02T00:00:00Z', on('2026-08-20'))).toBe('unchanged');
    expect(repo.rows).toHaveLength(1);
  });

  // 공지가 갱신된다 — 덮어쓰지 않고 새 행 + 이전 행 superseded_at
  it('내용이 바뀌면 새 행 + 이전 행 supersede', async () => {
    const { reconcile, repo, current } = setup();
    await reconcile('2026-08-01T00:00:00Z', on('2026-08-20'));

    expect(await reconcile('2026-08-10T00:00:00Z', on('2026-08-22'))).toBe('created');
    expect(repo.rows).toHaveLength(2);
    expect(repo.rows[0].supersededAt).toEqual(at('2026-08-10T00:00:00Z'));
    expect(current().map((row) => row.scheduledOn)).toEqual(['2026-08-22']);
  });

  // 예정은 「앞으로 일어날 일」이다. 날짜가 지나 사라지면 유효 행이 남지 않는다
  it('예정이 사라지면 유효 행을 supersede한다', async () => {
    const { reconcile, current, repo } = setup();
    await reconcile('2026-08-01T00:00:00Z', on('2026-08-20'));

    expect(await reconcile('2026-08-25T00:00:00Z', null)).toBe('superseded');
    expect(current()).toHaveLength(0);
    expect(repo.rows[0].supersededAt).toEqual(at('2026-08-25T00:00:00Z'));
  });

  // 정규화 재실행: 과거 mention을 다시 본다. 기록된 이력을 뒤집으면 안 된다
  it('최신 행보다 오래된 관측은 무시한다 — 재실행 멱등', async () => {
    const { reconcile, repo } = setup();
    await reconcile('2026-08-01T00:00:00Z', on('2026-08-20'));
    await reconcile('2026-08-10T00:00:00Z', on('2026-08-22'));
    await reconcile('2026-08-25T00:00:00Z', null);
    const snapshot = JSON.stringify(repo.rows);

    // 같은 mention 3개를 같은 순서로 다시
    expect(await reconcile('2026-08-01T00:00:00Z', on('2026-08-20'))).toBe('stale');
    expect(await reconcile('2026-08-10T00:00:00Z', on('2026-08-22'))).toBe('stale');
    expect(await reconcile('2026-08-25T00:00:00Z', null)).toBe('stale');

    expect(JSON.stringify(repo.rows)).toBe(snapshot);
  });

  it('예정이 없는 item에 없는 관측은 아무것도 하지 않는다', async () => {
    const { reconcile, repo } = setup();

    expect(await reconcile('2026-08-01T00:00:00Z', null)).toBe('unchanged');
    expect(repo.rows).toHaveLength(0);
  });
});
