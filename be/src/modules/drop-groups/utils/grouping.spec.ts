import { groupByDate, judgeKind, normalizeHandle } from './grouping';

describe('judgeKind', () => {
  it('제목의 단어로 판정한다', () => {
    expect(judgeKind('8月21日発売商品')).toBe('release');
    expect(judgeKind('予約商品')).toBe('preorder');
    expect(judgeKind('1月30日再入荷商品')).toBe('restock');
    expect(judgeKind('再販商品')).toBe('restock');
  });

  // 실측: pre20250130의 title이 1月30日再入荷商品이었다
  it('핸들 접두어와 제목이 어긋나면 제목이 이긴다', () => {
    expect(judgeKind('1月30日再入荷商品')).toBe('restock');
  });

  // 컬렉션 하나가 발표 하나가 아니다 (§5.2)
  it('혼합 컬렉션은 null — 컬렉션으로 묶지 않는다', () => {
    expect(judgeKind('12月19日発売＆再入荷商品')).toBeNull();
    expect(judgeKind('8月21日発売＆セール商品')).toBe('release');
  });

  it('신호가 없으면 null', () => {
    expect(judgeKind('ぬいぐるみ')).toBeNull();
  });
});

describe('normalizeHandle', () => {
  // pre20251024 / pre20251024_ 변종. 정규화 안 하면 같은 발표가 둘로 갈린다
  it('말미 밑줄을 없앤다', () => {
    expect(normalizeHandle('pre20251024_')).toBe(normalizeHandle('pre20251024'));
    expect(normalizeHandle('chiikawababy__')).toBe('chiikawababy');
  });
});

describe('groupByDate', () => {
  const base = { releaseOn: null, preorderOn: null, brandId: '7', restockDates: [] };

  // 같은 날 その他끼리 전부 묶으면 관계없는 굿즈가 한 발표로 뭉친다
  it('브랜드 미판정은 묶지 않는다', () => {
    expect(groupByDate({ ...base, brandId: null, releaseOn: '2026-08-21' })).toBeNull();
  });

  it('날짜가 하나도 없으면 묶지 않는다', () => {
    expect(groupByDate(base)).toBeNull();
  });

  it('예약이 있으면 예약이 대표다 — 사전 감지가 차별점이다', () => {
    expect(groupByDate({ ...base, preorderOn: '2026-08-28', releaseOn: '2026-09-10' })).toEqual({
      key: '2026-08-28:7:preorder',
      kind: 'preorder',
      primaryDate: '2026-08-28',
    });
  });

  it('재입고는 가장 최근 것만 본다 — 과거가 누적된다', () => {
    expect(groupByDate({ ...base, restockDates: ['2023-12-21', '2026-04-15'] })?.key).toBe(
      '2026-04-15:7:restock',
    );
  });

  // 같은 날 같은 브랜드에서 예약과 재입고가 동시에 일어난다. 섞으면 알림 문구를 못 만든다
  it('같은 날 같은 브랜드라도 kind가 다르면 다른 키다', () => {
    const preorder = groupByDate({ ...base, preorderOn: '2026-08-21' })?.key;
    const restock = groupByDate({ ...base, restockDates: ['2026-08-21'] })?.key;

    expect(preorder).not.toBe(restock);
  });
});
