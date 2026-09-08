import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  archiveEnvelopeSchema,
  calendarEnvelopeSchema,
  calendarEventSchema,
  cardSchema,
  homeEnvelopeSchema,
  parseEach,
} from './schema';

// jest rootDir는 src다. 픽스처는 fe/test/fixtures (#13 F1)
const FIXTURES = path.join(__dirname, '..', '..', 'test', 'fixtures');
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(path.join(FIXTURES, `${name}.json`), 'utf8'));

describe('픽스처가 스키마를 통과한다', () => {
  it('home', () => {
    const home = homeEnvelopeSchema.parse(fixture('home'));
    const log = jest.fn();
    const onSale = parseEach(cardSchema, home.onSale, 'onSale', log);
    const upcoming = parseEach(cardSchema, home.upcoming, 'upcoming', log);
    const waitable = parseEach(cardSchema, home.waitable, 'waitable', log);
    expect(log).not.toHaveBeenCalled();
    expect(onSale).toHaveLength(home.onSale.length);
    expect(upcoming).toHaveLength(home.upcoming.length);
    expect(waitable).toHaveLength(home.waitable.length);
  });

  it('calendar', () => {
    const calendar = calendarEnvelopeSchema.parse(fixture('calendar'));
    const log = jest.fn();
    const events = parseEach(calendarEventSchema, calendar.events, 'events', log);
    expect(log).not.toHaveBeenCalled();
    expect(events).toHaveLength(calendar.events.length);
    // 굿즈가 아니라 사건 — 같은 카드가 예약일·발매일에 두 번 나온다
    const ids = events.flatMap((event) => event.items.map((item) => item.id));
    expect(new Set(ids).size).toBeLessThan(ids.length);
    // 발표 단위로 접혀 온다 — 2건 이상인 사건이 있고, 미판정은 1건이다
    expect(events.some((event) => event.items.length > 1)).toBe(true);
    expect(events.filter((e) => e.brand === null).every((e) => e.items.length === 1)).toBe(true);
  });

  it('archive', () => {
    const archive = archiveEnvelopeSchema.parse(fixture('archive'));
    const log = jest.fn();
    const items = parseEach(cardSchema, archive.items, 'items', log);
    expect(log).not.toHaveBeenCalled();
    expect(items).toHaveLength(archive.items.length);
    expect(archive.nextCursor).toEqual(expect.any(String));
  });
});

describe('parseEach — 깨진 항목은 빼고 로그', () => {
  const home = homeEnvelopeSchema.parse(fixture('home'));
  const good = home.onSale[0];

  it('한 항목이 깨져도 나머지는 살린다', () => {
    const broken = { ...(good as object), status: 'RESTOCK' }; // 상태는 3개뿐
    const log = jest.fn();
    const cards = parseEach(cardSchema, [good, broken, good], 'onSale', log);
    expect(cards).toHaveLength(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('onSale[1]');
    expect(log.mock.calls[0][0]).toContain('status');
  });

  it('sources는 1건 이상 — 출처 없는 카드는 받지 않는다', () => {
    const noSource = { ...(good as object), sources: [] };
    expect(cardSchema.safeParse(noSource).success).toBe(false);
  });

  it('사건의 items는 1건 이상', () => {
    const calendar = calendarEnvelopeSchema.parse(fixture('calendar'));
    const event = calendar.events[0] as object;
    expect(calendarEventSchema.safeParse({ ...event, items: [] }).success).toBe(false);
  });

  it('날짜는 YYYY-MM-DD만', () => {
    const badDate = { ...(good as object), releaseOn: '2026/09/05' };
    expect(cardSchema.safeParse(badDate).success).toBe(false);
  });
});
