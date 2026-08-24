/**
 * 열거값은 `text` + `CHECK`다 (docs/db-schema.md §1).
 * Postgres `enum` 타입은 값 추가에 `ALTER TYPE`이 필요해 migration이 무거워진다.
 *
 * CHECK 식을 상수 배열에서 만든다 — 배열과 DDL이 어긋날 수 없게 한다.
 */
export function inList(column: string, values: readonly string[]): string {
  return `"${column}" IN (${values.map((v) => `'${v}'`).join(', ')})`;
}

/** nullable 열거 컬럼. NULL은 "미판정"이므로 허용한다 */
export function inListOrNull(column: string, values: readonly string[]): string {
  return `"${column}" IS NULL OR ${inList(column, values)}`;
}
