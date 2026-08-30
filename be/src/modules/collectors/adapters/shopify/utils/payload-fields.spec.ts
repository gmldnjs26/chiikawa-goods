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
    images: [
      { src: 'https://cdn.shopify.com/1.jpg', alt: '상품 설명 텍스트', updated_at: 'now', width: 800 },
      { src: 'https://cdn.shopify.com/2.jpg' },
    ],
    image: { src: 'https://cdn.shopify.com/1.jpg' },
    variants: [{ id: 2, price: '990', available: true, featured_image: { src: 'x' } }],
  };

  it('설명문을 남기지 않는다', () => {
    const kept = keepAllowedFields(product);

    expect(kept).not.toHaveProperty('body_html');
    expect(kept).not.toHaveProperty('image');
    expect(JSON.stringify(kept)).not.toContain('상품 설명문 전문');
  });

  // 카드에 1장을 쓴다. URL 문자열은 파일이 아니다 — docs/source-mapping.md §1
  it('이미지는 첫 장의 src 하나만 남긴다', () => {
    const kept = keepAllowedFields(product);

    expect(kept.images).toEqual([{ src: 'https://cdn.shopify.com/1.jpg' }]);
  });

  // images[].updated_at은 요청마다 바뀐다. 남기면 payload_hash가 매번 달라진다.
  // 문자열 전체를 훑으면 안 된다 — updated_at은 상품 레벨에서는 남기는 필드라
  // 픽스처가 그걸 갖는 순간 이미지와 무관한 이유로 깨진다. 이미지 객체만 본다
  it('이미지 객체에 src 외의 키를 남기지 않는다', () => {
    const [image] = keepAllowedFields(product).images as Record<string, unknown>[];

    expect(Object.keys(image)).toEqual(['src']);
  });

  it('이미지가 없으면 키 자체를 만들지 않는다', () => {
    expect(keepAllowedFields({ id: 1, images: [] })).not.toHaveProperty('images');
    expect(keepAllowedFields({ id: 1 })).not.toHaveProperty('images');
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
