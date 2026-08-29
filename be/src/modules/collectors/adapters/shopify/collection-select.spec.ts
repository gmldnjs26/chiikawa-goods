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
    const { handles: selected } = selectCollections(handles, config({ always: ['newitems', '없는핸들'] }), NOW);
    expect(selected).toEqual(['newitems']);
  });

  it('앞뒤 recent_days 안의 날짜 컬렉션을 잡는다 — 미래도 본다', () => {
    const { handles: selected } = selectCollections(
      handles,
      config({ always: [], date_pattern: '^(?:pre|re|new-re)?(\\d{8})', recent_days: 14 }),
      NOW,
    );
    expect(selected.sort()).toEqual(['20260821', 'pre20260910', 're20260820']);
  });

  it('date_pattern이 null이면 날짜 컬렉션을 돌지 않는다 — 규칙 없으면 건너뛴다', () => {
    const { handles: selected } = selectCollections(handles, config({ always: ['all'], date_pattern: null }), NOW);
    expect(selected).toEqual(['all']);
  });

  it('중복을 만들지 않는다', () => {
    const { handles: selected } = selectCollections(
      ['20260821'],
      config({ always: ['20260821'], date_pattern: '^(\\d{8})', recent_days: 14 }),
      NOW,
    );
    expect(selected).toEqual(['20260821']);
  });
});

describe('selectCollections — 요청 예산', () => {
  it('상한을 넘으면 자르고 몇 개를 뺐는지 알린다', () => {
    // 실제 날짜여야 한다. `20260001`은 파싱되지 않고 조용히 빠진다
    const many = Array.from({ length: 28 }, (_, i) => `202608${String(i + 1).padStart(2, '0')}`);
    const result = selectCollections(
      [...many, 'newitems'],
      sourceConfigSchema.parse({
        poll_collections: {
          always: ['newitems'],
          date_pattern: '^(\\d{8})',
          recent_days: 30,
          max_collections: 5,
        },
      }),
      NOW,
    );

    expect(result.handles).toHaveLength(5);
    expect(result.dropped).toBeGreaterThan(0);
    // always가 먼저 살아남는다 — 신상 유입구를 날짜 컬렉션이 밀어내면 안 된다
    expect(result.handles[0]).toBe('newitems');
  });

  it('상한 안이면 아무것도 버리지 않는다', () => {
    const result = selectCollections(['newitems'], config({ always: ['newitems'] }), NOW);
    expect(result.dropped).toBe(0);
  });
});

describe('selectCollections — 결정성', () => {
  const dated = Array.from({ length: 20 }, (_, i) => `202608${String(i + 10).padStart(2, '0')}`);
  const capped = sourceConfigSchema.parse({
    poll_collections: {
      always: ['newitems'],
      date_pattern: '^(\\d{8})',
      recent_days: 30,
      max_collections: 6,
    },
  });

  it('sitemap 순서가 달라도 같은 컬렉션이 살아남는다', () => {
    const forward = selectCollections(['newitems', ...dated], capped, NOW);
    const reversed = selectCollections([...dated].reverse().concat('newitems'), capped, NOW);

    // 순서가 아니라 **집합**이 흔들리면 payload_hash가 흔들린다
    expect(reversed.handles).toEqual(forward.handles);
    expect(forward.handles).toHaveLength(6);
  });

  it('상한에 걸리면 창의 바깥쪽부터 버린다', () => {
    const { handles } = selectCollections(dated, capped, NOW);
    // NOW = 2026-08-29. 가까운 날짜가 남는다
    expect(handles).toContain('20260829');
    expect(handles).not.toContain('20260810');
  });
});
