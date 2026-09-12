import { groupBySeries, representativeImages } from './series';

const c = (id: string, ...series: string[]) => ({ id, series });

describe('groupBySeries', () => {
  it('series[0]으로 묶고 건수 내림차순, 없는 것은 その他(null)로 마지막', () => {
    const groups = groupBySeries([c('1'), c('2', 'A'), c('3', 'B'), c('4', 'B'), c('5'), c('6')]);
    expect(groups.map((g) => [g.series, g.cards.length])).toEqual([
      ['B', 2],
      ['A', 1],
      [null, 3],
    ]);
  });

  // 두 시리즈에 걸친 상품은 대표(첫 원소)로만 — 두 곳에 넣지 않는다
  it('두 시리즈면 첫 원소', () => {
    const groups = groupBySeries([c('1', 'A', 'B'), c('2', 'B')]);
    expect(groups.map((g) => [g.series, g.cards.map((x) => x.id)])).toEqual([
      ['A', ['1']],
      ['B', ['2']],
    ]);
  });

  it('전부 없으면 その他 하나', () => {
    expect(groupBySeries([c('1'), c('2')])).toEqual([{ series: null, cards: [c('1'), c('2')] }]);
  });
});

describe('representativeImages', () => {
  it('순서대로 imageUrl 있는 것만 최대 4장', () => {
    const cards = [null, 'a', null, 'b', 'c', 'd', 'e'].map((imageUrl) => ({ imageUrl }));
    expect(representativeImages(cards)).toEqual(['a', 'b', 'c', 'd']);
    expect(representativeImages(cards, 2)).toEqual(['a', 'b']);
    expect(representativeImages([{ imageUrl: null }])).toEqual([]);
    expect(representativeImages([{ imageUrl: 'a' }, { imageUrl: 'a' }])).toEqual(['a']);
  });
});
