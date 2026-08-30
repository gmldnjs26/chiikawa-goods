import { keepAllowedFields } from './payload-fields';

describe('keepAllowedFields', () => {
  const product = {
    id: 1,
    handle: 'h',
    title: 't',
    tags: ['20260821'],
    published_at: '2026-08-21T11:00:00+09:00',
    // 저작물. 저장하면 전재다
    body_html: '<p>상품 설명문 전문</p>',
    images: [{ src: 'https://cdn.shopify.com/x.jpg' }],
    image: { src: 'https://cdn.shopify.com/x.jpg' },
    variants: [{ id: 2, price: '990', available: true, featured_image: { src: 'x' } }],
  };

  it('설명문과 이미지를 남기지 않는다', () => {
    const kept = keepAllowedFields(product);

    expect(kept).not.toHaveProperty('body_html');
    expect(kept).not.toHaveProperty('images');
    expect(kept).not.toHaveProperty('image');
    expect(JSON.stringify(kept)).not.toContain('cdn.shopify.com');
  });

  it('판정에 쓰는 필드는 남긴다', () => {
    const kept = keepAllowedFields(product);

    expect(kept.id).toBe(1);
    expect(kept.tags).toEqual(['20260821']);
    expect(kept.published_at).toBe('2026-08-21T11:00:00+09:00');
    expect(kept.variants).toEqual([{ id: 2, price: '990', available: true }]);
  });

  it('화이트리스트 밖의 새 필드가 생겨도 통과하지 않는다', () => {
    expect(keepAllowedFields({ id: 1, brand_new_field: 'x' })).not.toHaveProperty('brand_new_field');
  });
});
