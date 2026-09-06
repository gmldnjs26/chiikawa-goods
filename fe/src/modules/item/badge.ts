import { daysBetween, formatCountdown, formatMonthDay, toJstCalendarDate } from '@/lib/format';
import type { Card, Schedule, ScheduleKind } from '@/lib/schema';

import { RESTOCK_BADGE_DAYS } from './consts';

/**
 * 뱃지 7종 (docs/plan.md §3.2) + 판정 불가 1종.
 * `tone`은 색 토큰이다 — 상태색은 의미에 고정: 판매중 green · 예정 orange · 재입고예정 blue · 종료 gray.
 * 색 단독으로 정보를 주지 않는다. `label`이 항상 같이 나간다.
 */
export type Badge =
  | { kind: 'on-sale'; label: '販売中'; tone: 'on-sale' }
  | { kind: 'restocked'; label: '再入荷'; tone: 'on-sale' }
  | { kind: 'upcoming'; label: string; tone: 'upcoming'; date: string; scheduleKind: ScheduleKind }
  | { kind: 'restock-dated'; label: string; tone: 'restock'; date: string }
  | { kind: 'restock-text'; label: string; tone: 'restock'; text: string }
  | { kind: 'restock-undecided'; label: '再入荷未定'; tone: 'undecided' }
  | { kind: 'sold-out'; label: '完売'; tone: 'ended' }
  | { kind: 'unknown'; label: '判定不可'; tone: 'undecided'; reason: string };

export type BadgeInput = Pick<
  Card,
  'id' | 'status' | 'schedules' | 'restockedAt' | 'preorderOn' | 'releaseOn'
>;

/**
 * 뱃지 = **상태 + 가장 가까운 예정**. 상태만으로 판정하지 않는다 (fe/CLAUDE.md §5).
 *
 * 같은 `kind`의 예정이 2건 이상이면 **판정 불가**다. `item_current_schedule` 뷰가 `DISTINCT ON`을
 * 일부러 뺐고(docs/read-api.md §2.3) 그 중복이 여기로 온다. 조용히 첫 행을 고르지 않는다 —
 * 로그를 남기고 이상을 드러낸다. 「없는 정보를 만들지 않는다」가 여기서 실행된다.
 *
 * @param today 기준 JST 달력일. 응답의 `today`를 그대로 넘긴다
 */
export function judgeBadge(
  card: BadgeInput,
  today: string,
  log: (message: string) => void = (message) => console.warn(message),
): Badge {
  const duplicated = findDuplicatedKind(card.schedules);
  if (duplicated !== null) {
    const reason = `같은 kind의 유효 예정이 2건 이상: ${duplicated}`;
    log(`[badge] item=${card.id} 판정 불가 — ${reason}`);
    return { kind: 'unknown', label: '判定不可', tone: 'undecided', reason };
  }

  switch (card.status) {
    case 'ON_SALE':
      return judgeOnSale(card, today);
    case 'UPCOMING':
      return judgeUpcoming(card, today, log);
    case 'ENDED':
      return judgeEnded(card);
  }
}

function findDuplicatedKind(schedules: readonly Schedule[]): ScheduleKind | null {
  const seen = new Set<ScheduleKind>();
  for (const schedule of schedules) {
    if (seen.has(schedule.kind)) return schedule.kind;
    seen.add(schedule.kind);
  }
  return null;
}

/** 🟢 販売中 / 📦 再入荷. 「방금」의 폭은 `RESTOCK_BADGE_DAYS` */
function judgeOnSale(card: BadgeInput, today: string): Badge {
  if (card.restockedAt !== null) {
    const elapsed = daysBetween(toJstCalendarDate(card.restockedAt), today);
    if (elapsed >= 0 && elapsed <= RESTOCK_BADGE_DAYS) {
      return { kind: 'restocked', label: '再入荷', tone: 'on-sale' };
    }
  }
  return { kind: 'on-sale', label: '販売中', tone: 'on-sale' };
}

/**
 * 🔜 D-n / 本日. 가장 가까운 `preorder` · `release` 예정 날짜.
 * 유효 예정이 없으면 카드의 `preorderOn` · `releaseOn`으로 대신한다 — 홈에는 안 나오지만 캘린더에는 나온다.
 * 그마저 없으면 판정 불가. 「곧」인데 언제인지 모른다는 것은 수집 지연이다 (docs/read-api.md §3.2).
 */
function judgeUpcoming(card: BadgeInput, today: string, log: (message: string) => void): Badge {
  const candidates = upcomingDates(card);
  if (candidates.length === 0) {
    const reason = 'UPCOMING인데 예정 날짜가 없다';
    log(`[badge] item=${card.id} 판정 불가 — ${reason}`);
    return { kind: 'unknown', label: '判定不可', tone: 'undecided', reason };
  }

  // 오늘 이후 중 가장 가까운 것 = 최소 날짜. 전부 지났으면 가장 최근 것 = 최대 날짜 (재관측 전이라 아직 UPCOMING이다)
  const future = candidates.filter((c) => daysBetween(today, c.date) >= 0);
  const nearest =
    future.length > 0
      ? future.reduce((a, b) => (b.date < a.date ? b : a))
      : candidates.reduce((a, b) => (b.date > a.date ? b : a));
  return {
    kind: 'upcoming',
    label: formatCountdown(daysBetween(today, nearest.date)),
    tone: 'upcoming',
    date: nearest.date,
    scheduleKind: nearest.kind,
  };
}

export interface DatedEvent {
  readonly date: string;
  readonly kind: ScheduleKind;
}

/**
 * UPCOMING 카드의 예약·발매 날짜. 뱃지(D-n)와 카드의 날짜 줄이 **같은 것**을 본다 — 여기 하나뿐이다.
 * 유효 예정(`schedules`)의 `preorder` · `release`가 우선. 없으면 카드의 `preorderOn` · `releaseOn`.
 * 날짜 오름차순.
 */
export function upcomingDates(
  card: Pick<BadgeInput, 'schedules' | 'preorderOn' | 'releaseOn'>,
): DatedEvent[] {
  const fromSchedules: DatedEvent[] = card.schedules
    .filter((s) => s.kind !== 'restock' && s.date !== null)
    .map((s) => ({ date: s.date as string, kind: s.kind }));
  const candidates = fromSchedules.length > 0 ? fromSchedules : [];
  if (candidates.length === 0) {
    if (card.preorderOn !== null) candidates.push({ date: card.preorderOn, kind: 'preorder' });
    if (card.releaseOn !== null) candidates.push({ date: card.releaseOn, kind: 'release' });
  }
  return candidates.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** ENDED — 재입고 예정의 유무·형태로 4갈래. 품절을 하나로 뭉개지 않는다 (docs/plan.md §3.2) */
function judgeEnded(card: BadgeInput): Badge {
  const restock = card.schedules.find((s) => s.kind === 'restock');
  if (restock === undefined) return { kind: 'sold-out', label: '完売', tone: 'ended' };
  if (restock.undecided)
    return { kind: 'restock-undecided', label: '再入荷未定', tone: 'undecided' };
  if (restock.date !== null) {
    return {
      kind: 'restock-dated',
      label: `再入荷 ${formatMonthDay(restock.date)}`,
      tone: 'restock',
      date: restock.date,
    };
  }
  if (restock.text !== null) {
    // 「9月下旬」은 원문 그대로. 날짜로 바꾸지 않는다
    return {
      kind: 'restock-text',
      label: `再入荷 ${restock.text}`,
      tone: 'restock',
      text: restock.text,
    };
  }
  // date · text · undecided 전부 비어 있다. 서버 제약상 오지 않는다 — 와도 만들어내지 않는다
  return { kind: 'sold-out', label: '完売', tone: 'ended' };
}
