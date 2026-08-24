import { sourceConfigSchema, toPatterns } from './source-config.schema';

describe('sourceConfigSchema', () => {
  it('chiikawamarket 형태 — 태그 규칙이 문자열 하나', () => {
    const parsed = sourceConfigSchema.parse({
      release_tag: '^(\\d{8})$',
      preorder_tag: '^PRE(\\d{8})$',
      restock_tag: '^RE(\\d{8})$',
      upcoming_tag: '販売開始前',
      tax_included: true,
      supports_preorder_detection: true,
    });
    expect(parsed.restock_tag).toBe('^RE(\\d{8})$');
    expect(parsed.supports_restock_backfill).toBe(false);
  });

  it('nagano-market 형태 — restock_tag가 배열이어도 통과한다', () => {
    const parsed = sourceConfigSchema.parse({
      restock_tag: ['^RE(\\d{8})$', '^RE(\\d{6})$'],
      relevance_filter: { include_tags: ['ちいかわ'], mixed_marker_tags: ['ナガノのくま'] },
      label_tag_source: 'character_table',
    });
    expect(toPatterns(parsed.restock_tag)).toHaveLength(2);
    expect(parsed.relevance_filter?.include_collections).toEqual([]);
  });

  it('mogumogu 형태 — null 규칙은 판정을 건너뛴다는 뜻이다', () => {
    const parsed = sourceConfigSchema.parse({
      release_tag: '^(\\d{4})年(\\d{1,2})月(\\d{1,2})日発売商品$',
      preorder_tag: null,
      restock_tag: null,
      upcoming_tag: null,
      label_tags: ['川越'],
    });
    expect(toPatterns(parsed.preorder_tag)).toEqual([]);
  });

  it('컴파일되지 않는 정규식은 거부한다 — 수집 중이 아니라 로드 시점에 잡는다', () => {
    expect(() => sourceConfigSchema.parse({ release_tag: '^(\\d{8}$' })).toThrow();
  });

  it('빈 config도 유효하다 — 규칙이 없으면 전부 건너뛴다', () => {
    const parsed = sourceConfigSchema.parse({});
    expect(parsed.release_tag).toBeNull();
    expect(parsed.tax_included).toBe(true);
  });
});
