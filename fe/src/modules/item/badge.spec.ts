import type { Schedule } from '@/lib/schema';

import { type BadgeInput, judgeBadge, upcomingDates } from './badge';
import { RESTOCK_BADGE_DAYS } from './consts';

const TODAY = '2026-09-06';

function schedule(partial: Partial<Schedule> & Pick<Schedule, 'kind'>): Schedule {
  return {
    date: null,
    text: null,
    undecided: false,
    observedAt: '2026-09-05T12:00:00.000Z',
    ...partial,
  };
}

function input(partial: Partial<BadgeInput> & Pick<BadgeInput, 'status'>): BadgeInput {
  return {
    id: '1',
    schedules: [],
    restockedAt: null,
    preorderOn: null,
    releaseOn: null,
    ...partial,
  };
}

const silent = () => {};

describe('ON_SALE', () => {
  it('🟢 販売中', () => {
    expect(judgeBadge(input({ status: 'ON_SALE' }), TODAY, silent)).toMatchObject({
      kind: 'on-sale',
      label: '販売中',
    });
  });

  // RESTOCK은 상태가 아니라 ENDED → ON_SALE 전이다. 「방금」의 폭은 화면 규칙
  it(`📦 再入荷 — 재입고 후 ${RESTOCK_BADGE_DAYS}일 이내`, () => {
    // 2026-09-05T02:00Z = JST 9/5 11:00. today 9/6 → 1일 경과
    const recent = input({ status: 'ON_SALE', restockedAt: '2026-09-05T02:00:00.000Z' });
    expect(judgeBadge(recent, TODAY, silent)).toMatchObject({ kind: 'restocked', label: '再入荷' });
  });

  it('재입고가 오래됐으면 🟢로 돌아간다', () => {
    const old = input({ status: 'ON_SALE', restockedAt: '2026-08-01T02:00:00.000Z' });
    expect(judgeBadge(old, TODAY, silent).kind).toBe('on-sale');
  });

  it('폭 경계: 딱 N일은 📦, N+1일은 🟢', () => {
    const at = (daysAgo: number) => {
      const d = new Date(Date.UTC(2026, 8, 6 - daysAgo, 2));
      return input({ status: 'ON_SALE', restockedAt: d.toISOString() });
    };
    expect(judgeBadge(at(RESTOCK_BADGE_DAYS), TODAY, silent).kind).toBe('restocked');
    expect(judgeBadge(at(RESTOCK_BADGE_DAYS + 1), TODAY, silent).kind).toBe('on-sale');
  });
});

describe('UPCOMING', () => {
  it('🔜 D-3 — 가장 가까운 preorder · release 예정', () => {
    const card = input({
      status: 'UPCOMING',
      schedules: [
        schedule({ kind: 'preorder', date: '2026-09-09' }),
        schedule({ kind: 'release', date: '2026-09-19' }),
      ],
    });
    expect(judgeBadge(card, TODAY, silent)).toMatchObject({
      kind: 'upcoming',
      label: 'D-3',
      date: '2026-09-09',
      scheduleKind: 'preorder',
    });
  });

  it('당일은 本日', () => {
    const card = input({
      status: 'UPCOMING',
      schedules: [schedule({ kind: 'release', date: '2026-09-06' })],
    });
    expect(judgeBadge(card, TODAY, silent)).toMatchObject({ kind: 'upcoming', label: '本日' });
  });

  it('restock 예정은 UPCOMING 판정에 쓰지 않는다', () => {
    const card = input({
      status: 'UPCOMING',
      schedules: [
        schedule({ kind: 'restock', date: '2026-09-07' }),
        schedule({ kind: 'release', date: '2026-09-10' }),
      ],
    });
    expect(judgeBadge(card, TODAY, silent)).toMatchObject({
      label: 'D-4',
      scheduleKind: 'release',
    });
  });

  it('유효 예정이 없으면 카드의 preorderOn · releaseOn으로 대신한다', () => {
    const card = input({ status: 'UPCOMING', preorderOn: '2026-09-08', releaseOn: '2026-09-20' });
    expect(judgeBadge(card, TODAY, silent)).toMatchObject({ label: 'D-2', date: '2026-09-08' });
  });

  it('지난 날짜만 있으면 가장 최근 것으로 本日 — 재관측 전이다', () => {
    const card = input({
      status: 'UPCOMING',
      schedules: [
        schedule({ kind: 'preorder', date: '2026-09-01' }),
        schedule({ kind: 'release', date: '2026-09-04' }),
      ],
    });
    expect(judgeBadge(card, TODAY, silent)).toMatchObject({
      label: '本日',
      date: '2026-09-04',
      scheduleKind: 'release',
    });
  });

  it('날짜가 하나도 없으면 판정 불가 + 로그', () => {
    const log = jest.fn();
    expect(judgeBadge(input({ status: 'UPCOMING' }), TODAY, log).kind).toBe('unknown');
    expect(log).toHaveBeenCalledTimes(1);
  });
});

describe('ENDED — 품절을 하나로 뭉개지 않는다', () => {
  it('🔵 再入荷 9/15 — 날짜 확정', () => {
    const card = input({
      status: 'ENDED',
      schedules: [schedule({ kind: 'restock', date: '2026-09-15' })],
    });
    expect(judgeBadge(card, TODAY, silent)).toMatchObject({
      kind: 'restock-dated',
      label: '再入荷 9/15',
      date: '2026-09-15',
    });
  });

  // 「9月下旬」을 날짜로 바꾸지 않는다
  it('🔵 再入荷 9月下旬 — 시기만. 원문 그대로', () => {
    const card = input({
      status: 'ENDED',
      schedules: [schedule({ kind: 'restock', text: '9月下旬' })],
    });
    expect(judgeBadge(card, TODAY, silent)).toMatchObject({
      kind: 'restock-text',
      label: '再入荷 9月下旬',
      text: '9月下旬',
    });
  });

  it('⚪️ 再入荷未定 — undecided가 date · text보다 우선', () => {
    const card = input({
      status: 'ENDED',
      schedules: [schedule({ kind: 'restock', undecided: true, text: '未定' })],
    });
    expect(judgeBadge(card, TODAY, silent)).toMatchObject({ kind: 'restock-undecided' });
  });

  it('🔴 完売 — 예정 없음', () => {
    expect(judgeBadge(input({ status: 'ENDED' }), TODAY, silent)).toMatchObject({
      kind: 'sold-out',
      label: '完売',
    });
  });

  it('restock이 아닌 예정만 있으면 完売', () => {
    const card = input({
      status: 'ENDED',
      schedules: [schedule({ kind: 'release', date: '2026-09-20' })],
    });
    expect(judgeBadge(card, TODAY, silent).kind).toBe('sold-out');
  });
});

describe('같은 kind의 예정이 2건 이상', () => {
  // item_current_schedule 뷰는 DISTINCT ON을 일부러 뺐다. 중복이 여기로 온다
  it('판정 불가로 낸다. 조용히 첫 행을 고르지 않는다', () => {
    const log = jest.fn();
    const card = input({
      id: '403',
      status: 'ENDED',
      schedules: [
        schedule({ kind: 'restock', date: '2026-09-20' }),
        schedule({ kind: 'restock', date: '2026-09-25' }),
      ],
    });
    expect(judgeBadge(card, TODAY, log)).toMatchObject({
      kind: 'unknown',
      label: '判定不可',
      reason: expect.stringContaining('restock'),
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('item=403'));
  });

  it('상태와 무관하게 적용된다 — ON_SALE도 판정 불가', () => {
    const card = input({
      status: 'ON_SALE',
      schedules: [
        schedule({ kind: 'release', date: '2026-09-20' }),
        schedule({ kind: 'release', date: '2026-09-21' }),
      ],
    });
    expect(judgeBadge(card, TODAY, silent).kind).toBe('unknown');
  });

  it('kind가 다르면 중복이 아니다', () => {
    const card = input({
      status: 'UPCOMING',
      schedules: [
        schedule({ kind: 'preorder', date: '2026-09-09' }),
        schedule({ kind: 'release', date: '2026-09-19' }),
        schedule({ kind: 'restock', date: '2026-10-01' }),
      ],
    });
    expect(judgeBadge(card, TODAY, silent).kind).toBe('upcoming');
  });
});

describe('upcomingDates — 뱃지와 날짜 줄이 같은 것을 본다', () => {
  it('유효 예정의 preorder · release를 날짜순으로', () => {
    const card = input({
      status: 'UPCOMING',
      schedules: [
        schedule({ kind: 'release', date: '2026-09-19' }),
        schedule({ kind: 'preorder', date: '2026-09-09' }),
        schedule({ kind: 'restock', date: '2026-09-01' }),
      ],
      preorderOn: '2026-08-01',
    });
    expect(upcomingDates(card)).toEqual([
      { kind: 'preorder', date: '2026-09-09' },
      { kind: 'release', date: '2026-09-19' },
    ]);
  });

  it('유효 예정이 없을 때만 preorderOn · releaseOn으로', () => {
    const card = input({ status: 'UPCOMING', preorderOn: '2026-09-08', releaseOn: '2026-09-20' });
    expect(upcomingDates(card).map((e) => e.date)).toEqual(['2026-09-08', '2026-09-20']);
    expect(upcomingDates(input({ status: 'UPCOMING' }))).toEqual([]);
  });
});
