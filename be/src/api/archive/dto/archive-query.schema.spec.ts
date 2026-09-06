import { encodeCursor } from '@/modules/catalog/utils/cursor';

import { archiveQuerySchema } from './archive-query.schema';

describe('archiveQuerySchema', () => {
  it('기본값 limit 30, cursor null', () => {
    expect(archiveQuerySchema.parse({})).toEqual({ limit: 30, cursor: null });
  });

  it('쿼리 문자열의 limit을 숫자로. 범위 밖은 거부', () => {
    expect(archiveQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(archiveQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(archiveQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(archiveQuerySchema.safeParse({ limit: '1.5' }).success).toBe(false);
  });

  it('커서를 해석해서 넘긴다. 깨진 커서는 거부', () => {
    const cursor = { statusAt: new Date('2026-09-01T02:00:00.000Z'), id: '612' };
    expect(archiveQuerySchema.parse({ cursor: encodeCursor(cursor) }).cursor).toEqual(cursor);
    expect(archiveQuerySchema.safeParse({ cursor: 'garbage' }).success).toBe(false);
  });
});
