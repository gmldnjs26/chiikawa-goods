import { decodeCursor, encodeCursor } from './cursor';

describe('cursor', () => {
  it('왕복한다', () => {
    const cursor = { statusAt: new Date('2026-09-01T02:00:00.000Z'), id: '612' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('깨진 값은 null. 첫 페이지로 조용히 돌아가지 않는다', () => {
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor(Buffer.from('2026-09-01|abc').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('yesterday|612').toString('base64url'))).toBeNull();
  });
});
