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
