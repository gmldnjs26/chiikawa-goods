/**
 * 아카이브 커서 (docs/read-api.md §5.2). `(statusAt, id)` keyset.
 *
 * 오프셋이 아닌 이유: 30분마다 `ENDED`가 위에 끼어들어 다음 페이지에서 같은 카드를 또 본다.
 * 화면은 이 값을 해석하지 않는다 — 불투명 문자열이고, 깨졌으면 400이다.
 */
export interface ArchiveCursor {
  readonly statusAt: Date;
  readonly id: string;
}

export function encodeCursor(cursor: ArchiveCursor): string {
  return Buffer.from(`${cursor.statusAt.toISOString()}|${cursor.id}`, 'utf8').toString('base64url');
}

/** 형식이 아니면 null. 예외를 던지지 않는다 — 경계(zod)가 400으로 바꾼다 */
export function decodeCursor(raw: string): ArchiveCursor | null {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const separator = decoded.lastIndexOf('|');
  if (separator < 0) return null;

  const statusAt = new Date(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (Number.isNaN(statusAt.getTime()) || !/^\d+$/.test(id)) return null;

  return { statusAt, id };
}
