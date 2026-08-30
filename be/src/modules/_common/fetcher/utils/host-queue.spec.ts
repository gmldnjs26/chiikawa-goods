import { HostQueue } from './host-queue';

/** 시작·종료 시각을 기록한다. 호출 순서만 보면 겹쳐도 통과한다 */
interface Span {
  start: number;
  end: number;
}

function overlaps(spans: Span[]): boolean {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  return sorted.some((span, i) => i > 0 && span.start < sorted[i - 1].end);
}

describe('HostQueue', () => {
  const task = (spans: Span[], ms: number) => async () => {
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, ms));
    spans.push({ start, end: Date.now() });
  };

  it('같은 호스트 요청은 겹치지 않는다 — 동시 요청 1', async () => {
    const queue = new HostQueue();
    const spans: Span[] = [];

    await Promise.all(
      Array.from({ length: 5 }, () => queue.run('example.com', 0, task(spans, 20))),
    );

    expect(spans).toHaveLength(5);
    expect(overlaps(spans)).toBe(false);
  });

  it('앞 작업이 실패해도 뒤가 막히지 않는다', async () => {
    const queue = new HostQueue();
    const failed = queue.run('example.com', 0, () => Promise.reject(new Error('boom')));

    await expect(failed).rejects.toThrow('boom');
    await expect(queue.run('example.com', 0, () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('최소 간격만큼 기다린다', async () => {
    const waits: number[] = [];
    const queue = new HostQueue((ms) => {
      waits.push(ms);
      return Promise.resolve();
    });

    await queue.run('example.com', 5000, () => Promise.resolve());
    await queue.run('example.com', 5000, () => Promise.resolve());

    // 첫 요청은 기다리지 않는다. 두 번째만 간격을 소비한다
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(4000);
  });

  it('호스트가 다르면 서로 기다리지 않는다', async () => {
    const queue = new HostQueue();
    const order: string[] = [];

    await Promise.all([
      queue.run('a.example', 0, async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        order.push('a');
      }),
      queue.run('b.example', 0, () => {
        order.push('b');
        return Promise.resolve();
      }),
    ]);

    expect(order).toEqual(['b', 'a']);
  });
});
