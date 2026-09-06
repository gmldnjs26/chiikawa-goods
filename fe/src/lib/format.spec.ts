import {
  daysBetween,
  formatCountdown,
  formatDate,
  formatDateTimeJst,
  formatMonthDay,
  formatPrice,
  formatScheduleWhen,
  formatSeriesTotal,
  formatWeekday,
  toJstCalendarDate,
} from './format';

describe('날짜', () => {
  it('8/25(月) — 일본 관례', () => {
    expect(formatMonthDay('2026-08-25')).toBe('8/25');
    expect(formatWeekday('2026-08-25')).toBe('火');
    expect(formatDate('2026-08-25')).toBe('8/25(火)');
    expect(formatDate('2026-09-06')).toBe('9/6(日)');
  });

  it('실행 환경 시간대와 무관하다 — 문자열을 자른다', () => {
    expect(formatMonthDay('2026-01-01')).toBe('1/1');
    expect(formatMonthDay('2026-12-31')).toBe('12/31');
  });

  it('daysBetween은 달력일 차이. 같은 날 0, 미래 양수, 과거 음수', () => {
    expect(daysBetween('2026-09-06', '2026-09-06')).toBe(0);
    expect(daysBetween('2026-09-06', '2026-09-09')).toBe(3);
    expect(daysBetween('2026-09-06', '2026-09-01')).toBe(-5);
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1);
  });

  it('카운트다운: 당일 이하 本日, 미래 D-n', () => {
    expect(formatCountdown(0)).toBe('本日');
    expect(formatCountdown(-1)).toBe('本日');
    expect(formatCountdown(3)).toBe('D-3');
  });
});

describe('가격 · 종수', () => {
  it('¥2,970. variant 간 다르면 최저가에 〜', () => {
    expect(formatPrice(2970)).toBe('¥2,970');
    expect(formatPrice(2970, true)).toBe('¥2,970〜');
    expect(formatPrice(500)).toBe('¥500');
  });

  it('가격이 없으면 null. 「未定」을 만들어내지 않는다', () => {
    expect(formatPrice(null)).toBeNull();
  });

  it('全8種. 총수가 없으면 ランダム만', () => {
    expect(formatSeriesTotal(8)).toBe('全8種');
    expect(formatSeriesTotal(null)).toBe('ランダム');
  });
});

describe('예정 시기 3상태', () => {
  it('date → 월/일', () => {
    expect(formatScheduleWhen({ date: '2026-09-15', text: null, undecided: false })).toBe('9/15');
  });

  // 「9月下旬」을 9/21로 바꾸지 않는다 (docs/plan.md §3.2)
  it('text → 원문 그대로', () => {
    expect(formatScheduleWhen({ date: null, text: '9月下旬', undecided: false })).toBe('9月下旬');
  });

  it('undecided → 未定', () => {
    expect(formatScheduleWhen({ date: null, text: null, undecided: true })).toBe('未定');
  });

  it('date가 있으면 text보다 우선한다', () => {
    expect(formatScheduleWhen({ date: '2026-09-15', text: '9月中旬', undecided: false })).toBe(
      '9/15',
    );
  });

  it('셋 다 비면 null. 만들어내지 않는다', () => {
    expect(formatScheduleWhen({ date: null, text: null, undecided: false })).toBeNull();
  });
});

describe('JST 시각', () => {
  it('ISO → JST 9/4 21:01', () => {
    expect(formatDateTimeJst('2026-09-04T12:01:13.559Z')).toBe('9/4 21:01');
  });

  it('ISO → JST 달력일. UTC 자정 직전은 JST 다음날', () => {
    expect(toJstCalendarDate('2026-09-04T15:00:00.000Z')).toBe('2026-09-05');
    expect(toJstCalendarDate('2026-09-04T14:59:59.000Z')).toBe('2026-09-04');
  });
});
