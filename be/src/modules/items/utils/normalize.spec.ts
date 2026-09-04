import { sourceConfigSchema } from '@/modules/sources/dto/source-config.schema';

import { judgeStatus, normalize, pickLabels } from './normalize';

/** 실제 시드값 (src/migrations/1787654400000-SeedChiikawamarket.ts) */
const market = sourceConfigSchema.parse({
  release_tag: '^(\\d{8})$',
  preorder_tag: '^PRE(\\d{8})$',
  restock_tag: '^RE(\\d{8})$',
  upcoming_tag: '販売開始前',
  tax_included: true,
  default_acquisition: 'fixed',
  default_region: 'online',
  label_tags_extra: ['海外NG', '数量制限'],
});

/** 실측 픽스처 형태 (test/fixtures/chiikawamarket/products-newitems.json) */
function payload(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 9617614733553,
    handle: '4571609399247',
    tags: ['20260710', 'PRE20260828', 'RE20260825', 'ちいかわ', '予約'],
    vendor: 'グレイ・パーカー・サービス',
    product_type: 'マスコット',
    images: [{ src: 'https://cdn.shopify.com/x.jpg' }],
    variants: [{ price: '1870', available: true }],
    _collections: ['newitems'],
    ...over,
  };
}

function run(over: Record<string, unknown> = {}, title = 'ちいかわ マスコット') {
  return normalize({
    payload: payload(over),
    rawTitle: title,
    url: 'https://chiikawamarket.jp/products/4571609399247',
    channel: 'online_official',
    config: market,
  });
}

describe('normalize', () => {
  it('태그에서 예약일과 발매일을 채운다', () => {
    const item = run();

    expect(item.releaseOn).toBe('2026-07-10');
    expect(item.preorderOn).toBe('2026-08-28');
  });

  // 과거 재입고가 누적된다. status_history 백필의 입력이다 (§3.4)
  it('재입고 날짜는 전부 넘긴다', () => {
    expect(run({ tags: ['RE20231221', 'RE20260415'] }).restockDates).toEqual([
      '2023-12-21',
      '2026-04-15',
    ]);
  });

  // Shopify는 가격을 문자열로 준다
  it('가격을 JPY 정수로 만든다', () => {
    expect(run().price).toBe(1870);
  });

  it('variant 간 최저가를 쓰고 편차를 표시한다', () => {
    const item = run({
      variants: [
        { price: '2970', available: false },
        { price: '1870', available: true },
      ],
    });

    expect(item.price).toBe(1870);
    expect(item.priceVaries).toBe(true);
    expect(item.variantAvailable).toBe(1);
    expect(item.variantTotal).toBe(2);
  });

  it('가격이 같으면 편차가 아니다', () => {
    expect(run({ variants: [{ price: '990' }, { price: '990' }] }).priceVaries).toBe(false);
  });

  it('이미지는 첫 장의 src만 쓴다', () => {
    expect(run().imageUrl).toBe('https://cdn.shopify.com/x.jpg');
  });

  it('이미지가 없으면 null — 카드는 자리를 비우고 선다', () => {
    expect(run({ images: [] }).imageUrl).toBeNull();
  });

  // 화이트리스트 밖은 버린다. 破棄対象商品이 카드에 뜨면 안 된다
  it('labels는 화이트리스트에 있는 태그만', () => {
    expect(run({ tags: ['海外NG', '破棄対象商品', 'ちいかわ'] }).labels).toEqual(['海外NG']);
  });

  // series_total이 없으면 random으로 두지 않는다 — CHECK가 막고 근거도 없다
  it('全N種이 없으면 fixed', () => {
    const item = run();

    expect(item.seriesTotal).toBeNull();
    expect(item.acquisition).toBe('fixed');
  });

  it('제목의 전각 全N種을 읽는다', () => {
    expect(run({}, 'アクリルスタンド（全７種ＢＯＸ）').seriesTotal).toBe(7);
  });

  it('판정 못 한 값은 비운다 — 추측으로 채우지 않는다', () => {
    const item = run({ tags: ['ぬいぐるみ'], images: [], variants: [], product_type: undefined });

    expect(item.releaseOn).toBeNull();
    expect(item.preorderOn).toBeNull();
    expect(item.price).toBeNull();
    expect(item.category).toBeNull();
  });
});

describe('judgeStatus', () => {
  // available 단독으로는 판정 불가 — 예약 개시 전과 매진 후가 둘 다 false다
  it('販売開始前 + 재고없음 = UPCOMING', () => {
    expect(judgeStatus(['販売開始前'], false, market)).toEqual({
      value: 'UPCOMING',
      conflict: false,
    });
  });

  it('태그 없음 + 재고있음 = ON_SALE', () => {
    expect(judgeStatus(['ちいかわ'], true, market)).toEqual({ value: 'ON_SALE', conflict: false });
  });

  it('태그 없음 + 재고없음 = ENDED', () => {
    expect(judgeStatus(['ちいかわ'], false, market)).toEqual({ value: 'ENDED', conflict: false });
  });

  // 모순은 조용히 한쪽으로 정하지 않는다. 태그 체계 변경의 첫 징후다
  it('販売開始前인데 재고가 있으면 UPCOMING + 경보', () => {
    expect(judgeStatus(['販売開始前'], true, market)).toEqual({ value: 'UPCOMING', conflict: true });
  });

  // もぐもぐ本舗에는 販売開始前이 없다. UPCOMING이 나오지 않는다
  it('upcoming 규칙이 없는 소스는 available 단독', () => {
    const mogumogu = sourceConfigSchema.parse({ upcoming_tag: null });

    expect(judgeStatus(['販売開始前'], false, mogumogu).value).toBe('ENDED');
  });
});

describe('pickLabels', () => {
  it('character_table은 참조 대상이 없어 캐릭터 라벨을 비운다', () => {
    const nagano = sourceConfigSchema.parse({ label_tag_source: 'character_table' });

    expect(pickLabels(['ハチワレ', 'うさぎ'], nagano)).toEqual([]);
  });
});
