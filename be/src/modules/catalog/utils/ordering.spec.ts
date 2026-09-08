import type { CalendarEvent, Card, Schedule } from '../dto/card.dto';
import {
  byDateThenId,
  compareEvents,
  compareId,
  nearestOpeningDate,
  nearestRestockDate,
} from './ordering';

function card(id: string, over: Partial<Card> = {}): Card {
  return {
    id,
    title: `t${id}`,
    officialUrl: 'https://example.test',
    imageUrl: null,
    price: null,
    priceVaries: false,
    brand: null,
    channel: 'online_official',
    region: 'online',
    acquisition: 'fixed',
    seriesTotal: null,
    labels: [],
    status: 'ENDED',
    statusAt: '2026-09-01T00:00:00.000Z',
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

function schedule(kind: Schedule['kind'], date: string | null, undecided = false): Schedule {
  return { kind, date, text: null, undecided, observedAt: '2026-09-01T00:00:00.000Z' };
}

describe('nearestOpeningDate', () => {
  it('preorder · release 중 가장 가까운 날짜. restock은 보지 않는다', () => {
    const c = card('1', {
      schedules: [
        schedule('release', '2026-09-20'),
        schedule('preorder', '2026-09-10'),
        schedule('restock', '2026-09-05'),
      ],
    });
    expect(nearestOpeningDate(c)).toBe('2026-09-10');
    expect(nearestOpeningDate(card('2'))).toBeNull();
  });
});

describe('nearestRestockDate', () => {
  it('undecided는 제외. text만 있는 것은 null', () => {
    expect(nearestRestockDate(card('1', { schedules: [schedule('restock', null)] }))).toBeNull();
    expect(
      nearestRestockDate(card('1', { schedules: [schedule('restock', '2026-09-15', true)] })),
    ).toBeNull();
    expect(nearestRestockDate(card('1', { schedules: [schedule('restock', '2026-09-15')] }))).toBe(
      '2026-09-15',
    );
  });
});

describe('byDateThenId', () => {
  it('날짜 오름차순, null은 뒤, 같으면 id', () => {
    const sorted = [
      card('10', { schedules: [schedule('restock', null)] }),
      card('9', { schedules: [schedule('restock', '2026-09-20')] }),
      card('2', { schedules: [schedule('restock', '2026-09-15')] }),
      card('11', { schedules: [schedule('restock', '2026-09-15')] }),
    ].sort(byDateThenId(nearestRestockDate));
    expect(sorted.map((c) => c.id)).toEqual(['2', '11', '9', '10']);
  });
});

describe('compareEvents', () => {
  const at = (date: string, channel: Card['channel'], title: string, count = 1): CalendarEvent => ({
    date,
    kind: 'release',
    brand: null,
    items: Array.from({ length: count }, (_, i) => card(String(i + 1), { channel, title })),
  });
  const label = (e: CalendarEvent) => `${e.date}/${e.items[0].channel}/${e.items[0].title}`;

  it('date → channel 선언 순서 → 첫 카드 title', () => {
    const sorted = [
      at('2026-09-02', 'online_official', 'a'),
      at('2026-09-01', 'kuji', 'a'),
      at('2026-09-01', 'online_official', 'b'),
      at('2026-09-01', 'online_official', 'a'),
    ].sort(compareEvents);
    expect(sorted.map(label)).toEqual([
      '2026-09-01/online_official/a',
      '2026-09-01/online_official/b',
      '2026-09-01/kuji/a',
      '2026-09-02/online_official/a',
    ]);
  });

  // 「51点」 한 줄이 개별 행들 사이에 묻히지 않게
  it('같은 채널 안에서는 접힌 사건이 먼저다', () => {
    const sorted = [
      at('2026-09-01', 'online_official', 'a'),
      at('2026-09-01', 'online_official', 'z', 3),
    ].sort(compareEvents);
    expect(sorted.map(label)).toEqual([
      '2026-09-01/online_official/z',
      '2026-09-01/online_official/a',
    ]);
  });
});

describe('compareId', () => {
  it('bigint 문자열을 수치 순으로', () => {
    expect(['10', '9', '100', '2'].sort(compareId)).toEqual(['2', '9', '10', '100']);
  });
});
