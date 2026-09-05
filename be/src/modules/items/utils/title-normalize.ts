/**
 * 제목 정규화 (docs/data-collection-design.md §9.2 2단계).
 *
 * 같은 굿즈가 소스마다 다른 제목으로 뜬다. dedupe 1단계(canonical URL)가 못 잡는 것을
 * 여기서 잡는다. **표시용이 아니다** — 화면에는 `item.title` 원문을 낸다.
 */
const BRACKETS = /[【】「」『』（）()[\]〔〕]/g;

/** 접두어. 「제목이 다른 것」이 아니라 「같은 것에 붙은 수식」이다 */
const PREFIXES = ['予約', '新作', '再入荷', '速報', 'まとめ'];

export function normalizeTitle(title: string): string {
  let text = toHalfWidth(title).toLowerCase();
  text = text.replace(BRACKETS, ' ');

  // 접두어는 제거 후 다시 앞으로 올 수 있다 — 【予約】【再入荷】처럼 겹쳐 붙는다
  let changed = true;
  while (changed) {
    changed = false;
    const trimmed = text.trimStart();

    for (const prefix of PREFIXES) {
      const lower = toHalfWidth(prefix).toLowerCase();
      if (trimmed.startsWith(lower)) {
        text = trimmed.slice(lower.length);
        changed = true;
        break;
      }
    }
  }
  // 공백 제거는 마지막이다. 먼저 지우면 접두어 경계를 못 찾는다
  return text.replace(/\s+/gu, '');
}

/**
 * 全角 → 半角. 영숫자·기호(FF01–FF5E)와 전각 공백만 바꾼다.
 *
 * **가나·한자는 건드리지 않는다.** 반각 가나(ﾊﾁﾜﾚ)로 바꾸면 표기가 갈리고,
 * 실측된 제목은 전부 전각 가나다.
 */
export function toHalfWidth(text: string): string {
  return text
    .replace(/[！-～]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/gu, ' ');
}

/**
 * 제목의 `（全N種）`에서 총 종류 수를 뽑는다 (docs/source-mapping.md §2).
 * **전각 숫자가 온다** — `（全７種ＢＯＸ）` 실측. 없으면 null.
 */
export function parseSeriesTotal(title: string): number | null {
  const match = /全(\d+)種/u.exec(toHalfWidth(title));
  if (match === null) return null;

  const total = Number(match[1]);
  return Number.isInteger(total) && total > 0 ? total : null;
}
