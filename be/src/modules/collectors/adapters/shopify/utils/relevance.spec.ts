import { sourceConfigSchema } from '@/modules/sources/dto/source-config.schema';

import { judgeRelevance } from './relevance';

/** docs/source-mapping.md §6 — nagano-market.jp 실제 config */
const nagano = sourceConfigSchema.parse({
  relevance_filter: {
    include_tags: ['ちいかわ', 'ちいかわキャラクターズ'],
    include_collections: ['chiikawa', 'chiikawa-characters'],
    mixed_marker_tags: ['ナガノのくま', 'もぐらコロッケ'],
  },
});

describe('judgeRelevance', () => {
  it('필터가 없는 소스는 전부 included다', () => {
    expect(judgeRelevance({ tags: ['なんでも'], collections: [] }, sourceConfigSchema.parse({}))).toBe(
      'included',
    );
  });

  it('치이카와 태그가 있으면 included', () => {
    expect(judgeRelevance({ tags: ['ちいかわ', 'うさぎ'], collections: [] }, nagano)).toBe('included');
  });

  it('컬렉션만으로도 included', () => {
    expect(judgeRelevance({ tags: [], collections: ['chiikawa'] }, nagano)).toBe('included');
  });

  it('다른 작품 신호가 섞이면 mixed — 단정하지 않는다', () => {
    expect(judgeRelevance({ tags: ['ちいかわ', 'ナガノのくま'], collections: [] }, nagano)).toBe('mixed');
  });

  it('신호가 없으면 excluded. 행은 그래도 남긴다', () => {
    expect(judgeRelevance({ tags: ['パグ'], collections: ['goods'] }, nagano)).toBe('excluded');
  });
});
