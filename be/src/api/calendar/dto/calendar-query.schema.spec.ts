import { calendarQuerySchema } from './calendar-query.schema';

describe('calendarQuerySchema', () => {
  it('둘 다 없으면 통과. 기본값은 컨트롤러가 채운다', () => {
    expect(calendarQuerySchema.safeParse({}).success).toBe(true);
  });

  it('둘 다 있으면 통과', () => {
    expect(calendarQuerySchema.safeParse({ from: '2026-09-01', to: '2026-09-30' }).success).toBe(
      true,
    );
  });

  it('하나만 오면 거부. 나머지를 추측하지 않는다', () => {
    expect(calendarQuerySchema.safeParse({ from: '2026-09-01' }).success).toBe(false);
  });

  it('실재하지 않는 날짜 · 뒤집힌 범위 · 62일 초과는 거부', () => {
    expect(calendarQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(
      false,
    );
    expect(calendarQuerySchema.safeParse({ from: '2026-09-30', to: '2026-09-01' }).success).toBe(
      false,
    );
    expect(calendarQuerySchema.safeParse({ from: '2026-09-01', to: '2026-11-03' }).success).toBe(
      false,
    );
    expect(calendarQuerySchema.safeParse({ from: '2026-09-01', to: '2026-11-02' }).success).toBe(
      true,
    );
  });
});
