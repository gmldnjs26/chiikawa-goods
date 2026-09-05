import { toPatterns } from '@/modules/sources/dto/source-config.schema';

/** JST 달력일 `YYYY-MM-DD`. Date를 쓰지 않는다 — 타임존이 하루를 밀어버린다 */
export type CalendarDate = string;

/**
 * 태그에서 날짜를 뽑는다 (docs/source-mapping.md §3.1–3.2).
 *
 * **규칙은 코드가 아니라 `source.config`에 있다.** 소스마다 형식이 다르고
 * 같은 소스 안에서도 변종이 공존한다 — `RE20260807`(8자리)과 `RE230302`(6자리).
 * 그래서 규칙은 패턴 1개가 아니라 배열이다.
 *
 * 매칭된 것이 여러 개면 **가장 최근 것**을 쓴다 (§3.2).
 */
export function matchTagDates(tags: readonly string[], rule: unknown): CalendarDate[] {
  const patterns = toPatterns(rule as string | string[] | null | undefined);
  if (patterns.length === 0) return [];

  const found: CalendarDate[] = [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern);

    for (const tag of tags) {
      const groups = regex.exec(tag)?.slice(1).filter((g) => g !== undefined);
      if (groups === undefined || groups.length === 0) continue;

      const date = groups.length === 1 ? fromDigits(groups[0]) : fromParts(groups);
      if (date !== null) found.push(date);
    }
  }
  return [...new Set(found)].sort();
}

/** 가장 최근 날짜. 없으면 null — **비운다. 추측으로 채우지 않는다** */
export function latestTagDate(tags: readonly string[], rule: unknown): CalendarDate | null {
  const dates = matchTagDates(tags, rule);
  return dates.length === 0 ? null : dates[dates.length - 1];
}

/**
 * `20260821`(8자리) 또는 `230302`(6자리 YYMMDD).
 *
 * 6자리를 8자리로 읽으면 `2302년 3월 2일`이 나온다. 연도 2자리는 `20xx`로 보정한다
 * (docs/source-mapping.md §3.1).
 */
function fromDigits(digits: string): CalendarDate | null {
  if (/^\d{8}$/.test(digits)) {
    return build(digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8));
  }
  if (/^\d{6}$/.test(digits)) {
    return build(`20${digits.slice(0, 2)}`, digits.slice(2, 4), digits.slice(4, 6));
  }
  return null;
}

/** `2026年8月7日発売商品`처럼 그룹이 나뉜 형식. 0 패딩이 없다 */
function fromParts(groups: string[]): CalendarDate | null {
  const [year, month, day] = groups;
  if (year === undefined || month === undefined || day === undefined) return null;
  return build(year, month, day);
}

/** 실재하는 날짜만 통과시킨다. `20261301`은 날짜가 아니다 */
function build(year: string, month: string, day: string): CalendarDate | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);

  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;

  // 2월 30일 같은 값을 거른다. UTC로 만들어 로컬 타임존이 날짜를 밀지 않게 한다
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;

  return `${pad(y, 4)}-${pad(m, 2)}-${pad(d, 2)}`;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}
