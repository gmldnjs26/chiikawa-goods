import {
  addDays,
  daysBetween,
  fromJstMidnight,
  isAfterObservation,
  isCalendarDate,
  monthBounds,
  toJstCalendarDate,
} from './jst-date';

describe('jst-date', () => {
  // UTC 23:00 = JST 다음날 08:00. 로컬 타임존으로 자르면 하루가 밀린다
  it('관측 시각을 JST 달력일로 만든다', () => {
    expect(toJstCalendarDate(new Date('2026-08-30T23:00:00Z'))).toBe('2026-08-31');
    expect(toJstCalendarDate(new Date('2026-08-30T14:59:59Z'))).toBe('2026-08-30');
    expect(toJstCalendarDate(new Date('2026-08-30T15:00:00Z'))).toBe('2026-08-31');
  });

  it('백필 시각은 그 날 00:00 JST다', () => {
    expect(fromJstMidnight('2023-12-21').toISOString()).toBe('2023-12-20T15:00:00.000Z');
  });

  // 당일은 미래가 아니다 — 태그가 붙었으면 그 날 일이 일어난 것이다
  it('관측일 다음날부터 미래다', () => {
    const observed = new Date('2026-08-30T10:00:00+09:00');

    expect(isAfterObservation('2026-08-31', observed)).toBe(true);
    expect(isAfterObservation('2026-08-30', observed)).toBe(false);
    expect(isAfterObservation('2026-08-29', observed)).toBe(false);
  });
});

describe('isCalendarDate', () => {
  it('실재하는 날짜만 참', () => {
    expect(isCalendarDate('2026-02-28')).toBe(true);
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('20260228')).toBe(false);
  });
});

describe('addDays / daysBetween', () => {
  it('월·연 경계를 넘는다', () => {
    expect(addDays('2026-08-30', 8)).toBe('2026-09-07');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-08-30', '2026-09-07')).toBe(8);
    expect(daysBetween('2026-09-05', '2026-09-05')).toBe(0);
  });
});

describe('monthBounds', () => {
  it('1일과 말일. 2월·12월 포함', () => {
    expect(monthBounds('2026-09-05')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthBounds('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthBounds('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});
