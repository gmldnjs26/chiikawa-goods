/**
 * 접힌 발표 안의 소그룹 (docs/read-api.md §4.0). `series[0]`이 키다.
 * 건수 내림차순, 시리즈 없는 것(`null` → その他)은 **마지막**. 같은 건수면 처음 나온 순.
 * 시리즈는 접기 키가 아니다 — 여기서만 쓴다.
 */
export interface HasSeries {
  readonly series: readonly string[];
}

export interface SeriesGroup<T extends HasSeries> {
  readonly series: string | null;
  readonly cards: readonly T[];
}

export function groupBySeries<T extends HasSeries>(cards: readonly T[]): SeriesGroup<T>[] {
  const buckets = new Map<string | null, T[]>();
  for (const card of cards) {
    const key = card.series[0] ?? null;
    const bucket = buckets.get(key);
    if (bucket !== undefined) bucket.push(card);
    else buckets.set(key, [card]);
  }
  const named = [...buckets.entries()].filter(([key]) => key !== null);
  named.sort((a, b) => b[1].length - a[1].length);
  const rest = buckets.get(null);
  return [
    ...named.map(([series, group]) => ({ series, cards: group })),
    ...(rest === undefined ? [] : [{ series: null, cards: rest }]),
  ];
}

/** 접힌 행의 대표 이미지 — `items` 순서대로 `imageUrl`이 있는 것만, 최대 `limit` */
export function representativeImages(
  cards: readonly { readonly imageUrl: string | null }[],
  limit = 4,
): string[] {
  // 같은 URL은 한 번 — 두 칸이 같은 그림이고, 실패 시 같이 사라진다
  const out = new Set<string>();
  for (const card of cards) {
    if (card.imageUrl !== null) out.add(card.imageUrl);
    if (out.size === limit) break;
  }
  return [...out];
}
