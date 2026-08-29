import type { SourceConfig } from '@/modules/sources/source-config.schema';

const DAY_MS = 24 * 60 * 60 * 1000;

interface DatedHandle {
  readonly handle: string;
  readonly distance: number;
  /** 예약 컬렉션은 미래 날짜다. 상한 절삭에서 먼저 살린다 */
  readonly future: boolean;
}

/**
 * 도는 컬렉션을 고른다 (docs/source-mapping.md §6.0).
 *
 * 실측에서 컬렉션이 1006개였다. 전부 도는 것은 불가능하고 상대에게도 무례하다.
 * 규칙은 전부 `config`에 있다 — 정규식을 여기에 박으면 소스마다 코드가 갈린다.
 */
export interface Selection {
  readonly handles: string[];
  /** 상한에 걸려 이번 실행에서 뺀 것. 0이 아니면 호출부가 로그로 남긴다 */
  readonly dropped: number;
}

export function selectCollections(handles: string[], config: SourceConfig, now: Date): Selection {
  const rule = config.poll_collections;
  const available = new Set(handles);

  // 없는 핸들을 요청하지 않는다. 404가 나면 실패로 기록되고 헬스가 흐려진다
  const always = rule.always.filter((handle) => available.has(handle));

  const dated = rule.date_pattern === null ? [] : matchDated(handles, rule.date_pattern, rule.recent_days, now);

  const selected = [...new Set([...always, ...dated])];
  const cap = rule.max_collections;

  // `always`를 먼저 살린다 — 신상 유입구를 날짜 컬렉션이 밀어내면 안 된다
  return { handles: selected.slice(0, cap), dropped: Math.max(0, selected.length - cap) };
}

/**
 * 앞뒤 양쪽을 본다 — 예약 컬렉션은 **미래 날짜**다. 미래를 자르면 예약 감지가 죽는다.
 *
 * **오늘에 가까운 순으로 정렬해서 돌려준다.** 두 가지 이유다 —
 * ① 상한에 걸릴 때 잘려 나가야 하는 건 창의 바깥쪽이지 sitemap이 마지막에 적은 것이 아니다
 * ② sitemap 순서는 보장되지 않는다. 그 순서로 자르면 실행마다 **다른 컬렉션이 살아남고**,
 *    같은 상품의 `_collections`가 달라져 `payload_hash`가 흔들린다.
 *    내용이 안 바뀌었는데 행이 쌓인다 — `updated_at`과 같은 실패가 다른 문으로 들어온다
 */
function matchDated(handles: string[], pattern: string, recentDays: number, now: Date): string[] {
  const regex = new RegExp(pattern);
  const windowMs = recentDays * DAY_MS;

  return handles
    .map((handle) => {
      const captured = regex.exec(handle)?.[1];
      const date = captured === undefined ? null : parseYyyymmdd(captured);
      if (date === null) return null;

      const offset = date.getTime() - now.getTime();
      return { handle, distance: Math.abs(offset), future: offset >= 0 };
    })
    .filter((entry): entry is DatedHandle => entry !== null)
    .filter((entry) => entry.distance <= windowMs)
    // 미래를 먼저 살린다 — 상한에 걸려 잘려 나가는 쪽이 예약 컬렉션이면
    // 「미래를 자르면 예약 감지가 죽는다」가 상한이라는 다른 문으로 되살아난다.
    // 거리가 같으면 핸들로 가른다. 정렬이 안정적이어야 결과가 결정적이다
    .sort(
      (a, b) =>
        Number(b.future) - Number(a.future) ||
        a.distance - b.distance ||
        a.handle.localeCompare(b.handle),
    )
    .map((entry) => entry.handle);
}

/** 판정 못 하면 `null`이다. 추측해서 채우지 않는다 */
function parseYyyymmdd(value: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
