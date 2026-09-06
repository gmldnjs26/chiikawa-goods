import { formatMonth, monthBounds, monthOf, parseMonth, shiftMonth } from './month';

describe('month', () => {
  it('parseMonth — YYYY-MM만. 깨진 값은 null', () => {
    expect(parseMonth('2026-09')).toBe('2026-09');
    expect(parseMonth(undefined)).toBeNull();
    expect(parseMonth('2026-13')).toBeNull();
    expect(parseMonth('2026-9')).toBeNull();
    expect(parseMonth('2026-09-01')).toBeNull();
  });

  it('monthBounds — 말일을 안다. 윤년 포함', () => {
    expect(monthBounds('2026-09')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthBounds('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('shiftMonth — 연을 넘는다', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-09', 0)).toBe('2026-09');
  });

  it('monthOf · formatMonth', () => {
    expect(monthOf('2026-09-15')).toBe('2026-09');
    expect(formatMonth('2026-09')).toBe('2026年9月');
  });
});
