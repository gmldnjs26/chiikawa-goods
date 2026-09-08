import { judgeBrand, parseMatchRules } from './match-rules';

/** docs/source-mapping.md §4의 예시 그대로 */
const restaurant = {
  id: '1',
  sortOrder: 10,
  rules: parseMatchRules({
    tags: ['ちいかわレストラン'],
    collections: ['chiikawababy', 'chiikawababy_'],
    title_patterns: ['^ちいかわ ちいかわレストラン'],
  }),
};

describe('judgeBrand', () => {
  it('태그로 판정한다', () => {
    expect(
      judgeBrand({ tags: ['ちいかわレストラン'], collections: [], title: '', source: 'x' }, [
        restaurant,
      ]),
    ).toBe('1');
  });

  it('컬렉션으로 판정한다', () => {
    expect(
      judgeBrand({ tags: [], collections: ['chiikawababy'], title: '', source: 'x' }, [restaurant]),
    ).toBe('1');
  });

  it('제목으로 판정한다', () => {
    expect(
      judgeBrand(
        { tags: [], collections: [], title: 'ちいかわ ちいかわレストラン マグ', source: 'x' },
        [restaurant],
      ),
    ).toBe('1');
  });

  // 화면에는 その他로 보여준다. 목록에서 빼지 않는다
  it('실패하면 null — 미판정이다', () => {
    expect(
      judgeBrand({ tags: ['ぬいぐるみ'], collections: [], title: 'ちいかわ', source: 'x' }, [
        restaurant,
      ]),
    ).toBeNull();
  });

  it('후보가 없어도 던지지 않는다 — 시드가 빠진 DB다', () => {
    expect(
      judgeBrand({ tags: ['なんでも'], collections: [], title: '', source: 'x' }, []),
    ).toBeNull();
  });

  // 단계를 섞으면 sort_order가 작은 쪽의 약한 근거가 강한 근거를 이긴다
  it('제목만 걸린 우선순위 높은 브랜드보다 태그가 걸린 쪽이 이긴다', () => {
    const byTitle = {
      id: '2',
      sortOrder: 1,
      rules: parseMatchRules({ title_patterns: ['ちいかわ'] }),
    };

    expect(
      judgeBrand(
        { tags: ['ちいかわレストラン'], collections: [], title: 'ちいかわ マグ', source: 'x' },
        [byTitle, restaurant],
      ),
    ).toBe('1');
  });

  it('같은 단계에서 여러 개면 sort_order가 작은 쪽', () => {
    const other = {
      id: '3',
      sortOrder: 5,
      rules: parseMatchRules({ tags: ['ちいかわレストラン'] }),
    };

    expect(
      judgeBrand({ tags: ['ちいかわレストラン'], collections: [], title: '', source: 'x' }, [
        restaurant,
        other,
      ]),
    ).toBe('3');
  });
});

describe('judgeBrand — 소스 매칭 (4단계)', () => {
  // 공식 스토어의 상품 태그에는 스토어명이 없다 (2026-09-06 실측 0/705). 소스가 곧 근거다
  const market = {
    id: '10',
    sortOrder: 10,
    rules: parseMatchRules({ sources: ['chiikawamarket'] }),
  };

  it('태그 · 컬렉션 · 제목이 전부 침묵하면 소스로 판정한다', () => {
    expect(
      judgeBrand(
        {
          tags: ['ぬいぐるみ'],
          collections: ['newitems'],
          title: 'ちいかわ マグ',
          source: 'chiikawamarket',
        },
        [market],
      ),
    ).toBe('10');
  });

  it('다른 소스면 걸리지 않는다', () => {
    expect(
      judgeBrand({ tags: [], collections: [], title: '', source: 'nagano-market' }, [market]),
    ).toBeNull();
  });

  // 같은 스토어에서 팔리는 一番くじ 같은 것은 태그가 이긴다 — 소스는 마지막 단계다
  it('태그로 걸린 브랜드가 소스로 걸린 브랜드를 이긴다', () => {
    const kuji = { id: '5', sortOrder: 50, rules: parseMatchRules({ tags: ['一番くじ'] }) };
    expect(
      judgeBrand({ tags: ['一番くじ'], collections: [], title: '', source: 'chiikawamarket' }, [
        market,
        kuji,
      ]),
    ).toBe('5');
  });
});

describe('parseMatchRules', () => {
  it('NULL과 깨진 형태를 빈 규칙으로 만든다 — 던지지 않는다', () => {
    const empty = { tags: [], collections: [], titlePatterns: [], sources: [] };
    expect(parseMatchRules(null)).toEqual(empty);
    expect(parseMatchRules('문자열')).toEqual(empty);
    expect(parseMatchRules({ tags: [1, 'ok'] }).tags).toEqual(['ok']);
  });

  // 규칙 하나가 깨졌다고 판정 전체를 멈추지 않는다
  it('컴파일 안 되는 정규식은 그 규칙만 버린다', () => {
    expect(parseMatchRules({ title_patterns: ['[', '^ok'] }).titlePatterns).toEqual(['^ok']);
  });
});
