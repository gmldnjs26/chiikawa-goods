import type { Card } from '../dto/card.dto';
import { foldEvents } from './fold-events';

const market = { code: 'chiikawa_market', label: 'ちいかわマーケット' };

function card(over: Partial<Card> & { id: string }): Card {
  return {
    title: `t${over.id}`,
    officialUrl: '',
    imageUrl: null,
    price: null,
    priceVaries: false,
    brand: market,
    channel: 'online_official',
    region: 'online',
    acquisition: 'fixed',
    seriesTotal: null,
    labels: [],
    status: 'UPCOMING',
    statusAt: '',
    preorderOn: null,
    releaseOn: null,
    timeEstimated: true,
    availableUntil: null,
    restockedAt: null,
    schedules: [],
    sources: [],
    drop: null,
    ...over,
  };
}

describe('foldEvents', () => {
  it('같은 날짜 · kind · 채널 · 브랜드를 한 사건으로 접는다', () => {
    const events = foldEvents([
      { date: '2026-09-18', kind: 'release', card: card({ id: '2', title: 'b' }) },
      { date: '2026-09-18', kind: 'release', card: card({ id: '1', title: 'a' }) },
      { date: '2026-09-18', kind: 'release', card: card({ id: '3', title: 'a' }) },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].brand).toEqual(market);
    // title → id
    expect(events[0].items.map((c) => c.id)).toEqual(['1', '3', '2']);
  });

  it('날짜 · kind · 채널 · 브랜드 중 하나라도 다르면 다른 사건이다', () => {
    const events = foldEvents([
      { date: '2026-09-18', kind: 'release', card: card({ id: '1' }) },
      { date: '2026-09-19', kind: 'release', card: card({ id: '2' }) },
      { date: '2026-09-18', kind: 'preorder', card: card({ id: '3' }) },
      { date: '2026-09-18', kind: 'release', card: card({ id: '4', channel: 'kuji' }) },
      {
        date: '2026-09-18',
        kind: 'release',
        card: card({ id: '5', brand: { code: 'pocket', label: 'p' } }),
      },
    ]);
    expect(events).toHaveLength(5);
  });

  // 미판정끼리 날짜만으로 묶으면 관계없는 굿즈가 한 발표가 된다 (docs/db-schema.md §6)
  it('브랜드 미판정은 접지 않는다 — 같은 날이라도 1건씩', () => {
    const events = foldEvents([
      { date: '2026-09-18', kind: 'release', card: card({ id: '1', brand: null }) },
      { date: '2026-09-18', kind: 'release', card: card({ id: '2', brand: null }) },
    ]);
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.brand === null && e.items.length === 1)).toBe(true);
  });

  // 재입고는 전이라서 원래 발표(drop)가 제각각이다. drop이 아니라 이 식으로 접는 이유
  it('drop이 달라도 같은 날 같은 브랜드의 재입고는 한 사건이다', () => {
    const events = foldEvents([
      {
        date: '2026-08-27',
        kind: 'restock',
        card: card({
          id: '1',
          drop: { id: '10', kind: 'release', date: '2026-06-10', title: null },
        }),
      },
      {
        date: '2026-08-27',
        kind: 'restock',
        card: card({
          id: '2',
          drop: { id: '11', kind: 'release', date: '2026-07-10', title: null },
        }),
      },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].items).toHaveLength(2);
  });
});
