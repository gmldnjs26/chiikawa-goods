import { sourceConfigSchema } from '@/modules/sources/source-config.schema';

import { selectCollections } from './collection-select';

const NOW = new Date('2026-08-29T12:00:00+09:00');
const config = (poll: unknown) => sourceConfigSchema.parse({ poll_collections: poll });

describe('selectCollections', () => {
  const handles = [
    'newitems',
    'all',
    '20260821', // 8일 전
    'pre20260910', // 12일 뒤 — 예약
    're20260820', // 9일 전
    '20250101', // 한참 전
    'chiikawababy', // 날짜가 아니다
  ];

  it('always는 sitemap에 있는 것만 돈다', () => {
    const selected = selectCollections(handles, config({ always: ['newitems', '없는핸들'] }), NOW);
    expect(selected).toEqual(['newitems']);
  });

  it('앞뒤 recent_days 안의 날짜 컬렉션을 잡는다 — 미래도 본다', () => {
    const selected = selectCollections(
      handles,
      config({ always: [], date_pattern: '^(?:pre|re|new-re)?(\\d{8})', recent_days: 14 }),
      NOW,
    );
    expect(selected.sort()).toEqual(['20260821', 'pre20260910', 're20260820']);
  });

  it('date_pattern이 null이면 날짜 컬렉션을 돌지 않는다 — 규칙 없으면 건너뛴다', () => {
    const selected = selectCollections(handles, config({ always: ['all'], date_pattern: null }), NOW);
    expect(selected).toEqual(['all']);
  });

  it('중복을 만들지 않는다', () => {
    const selected = selectCollections(
      ['20260821'],
      config({ always: ['20260821'], date_pattern: '^(\\d{8})', recent_days: 14 }),
      NOW,
    );
    expect(selected).toEqual(['20260821']);
  });
});
