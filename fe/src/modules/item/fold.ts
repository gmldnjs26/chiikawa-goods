/**
 * 필터 뒤 접기 (docs/read-api.md §3.4). 순수 함수 — 컴포넌트에서 판정하지 않는다 (fe/CLAUDE.md §5).
 * 같은 `drop.id`의 카드를 **처음 나온 자리에** 모은다. 1건뿐인 발표는 접지 않는다 — 접을 것이 없다.
 * 「N点」은 여기 들어온 건수다 — 그 섹션 · 그 필터에서 보이는 건수이지 발표 전체가 아니다.
 */
export interface Foldable {
  readonly drop: { readonly id: string; readonly title: string } | null;
}

export type FoldedRow<T extends Foldable> =
  | { readonly kind: 'card'; readonly card: T }
  | { readonly kind: 'drop'; readonly title: string; readonly cards: readonly T[] };

export function foldByDrop<T extends Foldable>(cards: readonly T[]): FoldedRow<T>[] {
  const rows: (FoldedRow<T> | { kind: 'drop'; title: string; cards: T[] })[] = [];
  const byDrop = new Map<string, T[]>();
  for (const card of cards) {
    if (card.drop === null) {
      rows.push({ kind: 'card', card });
      continue;
    }
    const bucket = byDrop.get(card.drop.id);
    if (bucket !== undefined) {
      bucket.push(card);
      continue;
    }
    const cardsOfDrop = [card];
    byDrop.set(card.drop.id, cardsOfDrop);
    rows.push({ kind: 'drop', title: card.drop.title, cards: cardsOfDrop });
  }
  return rows.map((row) =>
    row.kind === 'drop' && row.cards.length === 1 ? { kind: 'card', card: row.cards[0] } : row,
  );
}
