import { fromJstMidnight, isAfterObservation, toJstCalendarDate } from './jst-date';

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
