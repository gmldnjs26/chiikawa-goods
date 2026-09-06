import { HistoryRow, summarizeRestocks } from './restock';

function row(status: HistoryRow['status'], at: string, isBackfilled = false): HistoryRow {
  return { status, observedAt: new Date(at), isBackfilled };
}

describe('summarizeRestocks', () => {
  it('이력이 없으면 재입고도 없다', () => {
    expect(summarizeRestocks([])).toEqual({ restockedAt: null, dates: [] });
  });

  it('첫 관측이 ON_SALE인 것은 재입고가 아니다', () => {
    expect(summarizeRestocks([row('ON_SALE', '2026-08-01T02:00:00Z')]).restockedAt).toBeNull();
  });

  // RESTOCK은 상태가 아니라 ENDED → ON_SALE 전이다. 반복된다
  it('ENDED → ON_SALE 전이마다 재입고. 가장 최근 것이 restockedAt', () => {
    const result = summarizeRestocks([
      row('ON_SALE', '2026-08-01T02:00:00Z'),
      row('ENDED', '2026-08-05T02:00:00Z'),
      row('ON_SALE', '2026-08-10T02:00:00Z'),
      row('ENDED', '2026-08-20T02:00:00Z'),
      row('ON_SALE', '2026-09-01T02:00:00Z'),
    ]);
    expect(result.restockedAt).toEqual(new Date('2026-09-01T02:00:00Z'));
    expect(result.dates).toEqual(['2026-08-10', '2026-09-01']);
  });

  // 백필 행은 태그 날짜 00:00 JST의 ON_SALE이다. 직전 행과 무관하게 재입고 사실이다
  it('백필 행은 그 자체가 재입고다', () => {
    const result = summarizeRestocks([
      row('ON_SALE', '2023-12-20T15:00:00Z', true), // RE20231221
      row('ON_SALE', '2026-08-30T09:38:25Z'),
    ]);
    expect(result.dates).toEqual(['2023-12-21']);
    expect(result.restockedAt).toEqual(new Date('2023-12-20T15:00:00Z'));
  });

  it('UPCOMING → ON_SALE는 발매지 재입고가 아니다', () => {
    const result = summarizeRestocks([
      row('UPCOMING', '2026-08-20T02:00:00Z'),
      row('ON_SALE', '2026-08-25T02:00:00Z'),
    ]);
    expect(result.restockedAt).toBeNull();
  });
});
