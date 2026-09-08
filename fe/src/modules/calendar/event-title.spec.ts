import { foldedEventTitle } from './event-title';

const drop = (title: string | null) => ({
  drop: { id: '1', kind: 'release' as const, date: null, title },
});

describe('foldedEventTitle', () => {
  it('drop.title이 전부 같으면 그것 — 컬렉션 제목', () => {
    expect(
      foldedEventTitle({
        kind: 'release',
        items: [drop('9月18日発売商品'), drop('9月18日発売商品')] as never,
      }),
    ).toBe('9月18日発売商品');
  });

  it('title이 null이면 kind 라벨', () => {
    expect(foldedEventTitle({ kind: 'release', items: [drop(null), drop(null)] as never })).toBe(
      '発売',
    );
  });

  // 재입고는 원래 발표가 제각각이다. 하나를 고르지 않는다
  it('title이 섞이면 kind 라벨', () => {
    expect(foldedEventTitle({ kind: 'restock', items: [drop('A'), drop('B')] as never })).toBe(
      '再入荷',
    );
    expect(foldedEventTitle({ kind: 'restock', items: [drop('A'), drop(null)] as never })).toBe(
      '再入荷',
    );
  });
});
