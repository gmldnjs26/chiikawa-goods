import type { DropKind } from '../entities/drop-group.entity';

/**
 * 발표 묶음 (docs/db-schema.md §6, docs/source-mapping.md §5).
 *
 * `drop`이 알림·화면의 단위다. 굿즈 20종을 알림 20개로 보내면 스팸이다.
 */
export interface GroupingInput {
  readonly releaseOn: string | null;
  readonly preorderOn: string | null;
  readonly brandId: string | null;
  readonly restockDates: readonly string[];
}

export interface Grouping {
  readonly key: string;
  readonly kind: DropKind;
  readonly primaryDate: string | null;
}

/**
 * `kind`는 **제목으로 판정한다** (§5.1).
 *
 * 실측: **`pre20250130`의 title이 `1月30日再入荷商品`**이었다.
 * 핸들 접두어와 내용이 어긋난 사례가 실재한다.
 */
export function judgeKind(collectionTitle: string): DropKind | null {
  const signals = [
    { kind: 'preorder' as const, present: collectionTitle.includes('予約') },
    {
      kind: 'restock' as const,
      present: collectionTitle.includes('再入荷') || collectionTitle.includes('再販'),
    },
    { kind: 'release' as const, present: collectionTitle.includes('発売') },
  ].filter((signal) => signal.present);

  // 둘 이상이면 혼합 컬렉션이다 — `12月19日発売＆再入荷商品`.
  // 컬렉션 하나가 발표 하나가 아니므로 컬렉션으로 묶지 않는다 (§5.2)
  return signals.length === 1 ? signals[0].kind : null;
}

/**
 * `grouping_key`를 정규화한다 (§5.4).
 * `pre20251024` / `pre20251024_` 처럼 접미 `_` 변종이 있다.
 * 정규화하지 않으면 같은 발표가 둘로 갈린다.
 */
export function normalizeHandle(handle: string): string {
  return handle.trim().replace(/_+$/u, '').toLowerCase();
}

/**
 * 컬렉션으로 묶지 못할 때의 2순위 — **같은 날짜 + 같은 브랜드 + 같은 `kind`**.
 *
 * `kind`까지 넣는 이유: 같은 날 같은 브랜드에서 예약 개시와 재입고가 동시에 일어난다.
 * 섞으면 알림 문구를 만들 수 없다.
 *
 * **브랜드 미판정은 묶지 않는다** — 같은 날 `その他`끼리 전부 묶으면
 * 관계없는 굿즈가 한 발표로 뭉친다. 단독으로 내고 수동 교정으로 나중에 묶는다.
 */
export function groupByDate(input: GroupingInput): Grouping | null {
  if (input.brandId === null) return null;

  const dated = firstDated(input);
  if (dated === null) return null;

  return {
    key: `${dated.date}:${input.brandId}:${dated.kind}`,
    kind: dated.kind,
    primaryDate: dated.date,
  };
}

/**
 * 어느 날짜가 이 발표를 대표하는가.
 *
 * 예약이 있으면 예약이다 — 그게 「최대 20일 전 사전 감지」라는 차별점의 단위다.
 * 재입고는 과거가 누적되므로 **가장 최근 것**만 본다.
 */
function firstDated(input: GroupingInput): { date: string; kind: DropKind } | null {
  if (input.preorderOn !== null) return { date: input.preorderOn, kind: 'preorder' };
  if (input.releaseOn !== null) return { date: input.releaseOn, kind: 'release' };

  const latest = [...input.restockDates].sort().at(-1);
  return latest === undefined ? null : { date: latest, kind: 'restock' };
}
