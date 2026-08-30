import { payloadHash } from './payload-hash';

describe('payloadHash', () => {
  it('키 순서가 달라도 같은 해시다', () => {
    expect(payloadHash({ a: 1, b: { c: 2, d: 3 } })).toBe(payloadHash({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it('_collections를 정렬해서 넣으면 순회 순서에 흔들리지 않는다', () => {
    const product = { id: 1, title: 'x' };
    const first = { ...product, _collections: ['newitems', '20260821'].sort() };
    const second = { ...product, _collections: ['20260821', 'newitems'].sort() };

    expect(payloadHash(first)).toBe(payloadHash(second));
  });

  it('내용이 바뀌면 해시가 바뀐다 — updated_at도 내용이다', () => {
    expect(payloadHash({ id: 1, updated_at: 'a' })).not.toBe(payloadHash({ id: 1, updated_at: 'b' }));
  });

  it('배열 순서는 내용이다 — 정렬해서 지우지 않는다', () => {
    expect(payloadHash({ tags: ['a', 'b'] })).not.toBe(payloadHash({ tags: ['b', 'a'] }));
  });
});

describe('payloadHash — hash_exclude', () => {
  it('요청마다 바뀌는 updated_at을 빼면 해시가 같다', () => {
    const a = { id: 1, updated_at: '2026-08-29T17:53:45+09:00', title: 't' };
    const b = { id: 1, updated_at: '2026-08-29T17:54:34+09:00', title: 't' };

    expect(payloadHash(a)).not.toBe(payloadHash(b));
    expect(payloadHash(a, ['updated_at'])).toBe(payloadHash(b, ['updated_at']));
  });

  it('중첩된 곳도 뺀다 — variants[].updated_at이 같은 이름이다', () => {
    const build = (stamp: string) => ({ id: 1, variants: [{ id: 2, updated_at: stamp }] });

    expect(payloadHash(build('a'), ['updated_at'])).toBe(payloadHash(build('b'), ['updated_at']));
  });

  it('제외해도 진짜 변경은 잡는다', () => {
    const a = { id: 1, updated_at: 'x', variants: [{ available: true }] };
    const b = { id: 1, updated_at: 'y', variants: [{ available: false }] };

    expect(payloadHash(a, ['updated_at'])).not.toBe(payloadHash(b, ['updated_at']));
  });
});
