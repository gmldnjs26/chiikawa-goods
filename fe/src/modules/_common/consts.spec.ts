import { formatCount, formatDropTitle } from './consts';

const market = { label: 'ちいかわマーケット' };

describe('formatDropTitle', () => {
  it('title이 있으면 그것 — 컬렉션 제목', () => {
    expect(
      formatDropTitle(
        { id: '1', kind: 'release', date: '2026-09-18', title: '9月18日発売商品' },
        market,
      ),
    ).toBe('9月18日発売商品');
  });

  it('없으면 브랜드 · 날짜 · kind', () => {
    expect(
      formatDropTitle({ id: '1', kind: 'release', date: '2026-09-18', title: null }, market),
    ).toBe('ちいかわマーケット 9/18(金) 発売');
    expect(
      formatDropTitle({ id: '1', kind: 'preorder', date: '2026-08-28', title: null }, market),
    ).toBe('ちいかわマーケット 8/28(金) 予約開始');
  });

  // 수동 묶음은 날짜가 없을 수 있다. 기계 키(id)는 절대 내지 않는다
  it('날짜가 없으면 빼고, id는 내지 않는다', () => {
    const title = formatDropTitle({ id: '99', kind: 'campaign', date: null, title: null }, market);
    expect(title).toBe('ちいかわマーケット キャンペーン');
    expect(title).not.toContain('99');
  });
});

describe('formatCount', () => {
  it('N点', () => {
    expect(formatCount(51)).toBe('51点');
  });
});
