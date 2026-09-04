import { latestTagDate, matchTagDates } from './tag-date';

/** 실제 시드값 (src/migrations/1787654*) */
const RELEASE = '^(\\d{8})$';
const RESTOCK_NAGANO = ['^RE(\\d{8})$', '^RE(\\d{6})$'];
const MOGUMOGU = '^(\\d{4})年(\\d{1,2})月(\\d{1,2})日発売商品$';

describe('matchTagDates', () => {
  it('규칙이 없으면 빈 배열 — 소스마다 지원 범위가 다르다', () => {
    expect(matchTagDates(['20260821'], null)).toEqual([]);
    expect(matchTagDates(['20260821'], undefined)).toEqual([]);
  });

  it('8자리 태그를 달력일로 만든다', () => {
    expect(matchTagDates(['20260821', 'ぬいぐるみ'], RELEASE)).toEqual(['2026-08-21']);
  });

  // RE230302를 8자리로 읽으면 2302년 3월 2일이 나온다 (docs/source-mapping.md §3.1)
  it('6자리 변종의 연도를 20xx로 보정한다', () => {
    expect(matchTagDates(['RE230302'], RESTOCK_NAGANO)).toEqual(['2023-03-02']);
  });

  it('8자리와 6자리가 공존해도 양쪽을 잡는다', () => {
    expect(matchTagDates(['RE20260807', 'RE230810'], RESTOCK_NAGANO)).toEqual([
      '2023-08-10',
      '2026-08-07',
    ]);
  });

  // 0 패딩이 없다 — 2026年8月7日
  it('그룹이 나뉜 형식도 읽는다', () => {
    expect(matchTagDates(['2026年8月7日発売商品'], MOGUMOGU)).toEqual(['2026-08-07']);
  });

  // 실측: 같은 상품에 20260710과 chiikawamovie-20260710이 함께 있었다
  it('접두어가 붙은 변종을 매칭하지 않는다 — 앵커가 그 일을 한다', () => {
    expect(matchTagDates(['chiikawamovie-20260710', '20260710'], RELEASE)).toEqual(['2026-07-10']);
  });

  it('실재하지 않는 날짜는 버린다', () => {
    expect(matchTagDates(['20261301', '20260230', '20260000'], RELEASE)).toEqual([]);
  });

  it('중복은 한 번만 센다', () => {
    expect(matchTagDates(['20260821', '20260821'], RELEASE)).toEqual(['2026-08-21']);
  });
});

describe('latestTagDate', () => {
  // 재입고 태그는 과거가 누적된다. 현재 날짜로 쓸 것은 가장 최근 것이다 (§3.2)
  it('여러 개면 가장 최근 것', () => {
    expect(latestTagDate(['RE20231221', 'RE20260415', 'RE20250101'], RESTOCK_NAGANO)).toBe(
      '2026-04-15',
    );
  });

  it('판정 못 하면 null — 비운다. 추측으로 채우지 않는다', () => {
    expect(latestTagDate(['ぬいぐるみ'], RELEASE)).toBeNull();
  });
});
