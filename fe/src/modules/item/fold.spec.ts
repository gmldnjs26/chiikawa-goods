import { foldByDrop } from './fold';

const a = { id: 'a', drop: { id: '1', title: 'ちいかわマーケット 9/18(金) 発売' } };
const b = { id: 'b', drop: { id: '1', title: 'ちいかわマーケット 9/18(金) 発売' } };
const c = { id: 'c', drop: { id: '2', title: 'もぐもぐ本舗 9/18(金) 発売' } };
const solo = { id: 's', drop: null };

describe('foldByDrop', () => {
  it('같은 drop을 처음 나온 자리에 모은다', () => {
    const rows = foldByDrop([a, solo, c, b]);
    expect(rows.map((r) => (r.kind === 'card' ? r.card.id : `drop:${r.cards.length}`))).toEqual([
      'drop:2',
      's',
      'c',
    ]);
    expect(rows[0]).toMatchObject({ kind: 'drop', title: a.drop.title });
  });

  it('1건뿐인 발표는 접지 않는다', () => {
    expect(foldByDrop([c])).toEqual([{ kind: 'card', card: c }]);
  });

  // 미판정(drop null)은 절대 묶이지 않는다 — 같은 브랜드 없음
  it('drop이 없는 카드는 각자 한 행이다', () => {
    expect(foldByDrop([solo, { ...solo, id: 't' }])).toHaveLength(2);
  });

  // N은 여기 들어온 건수다 — 필터가 하나를 지우면 N도 준다
  it('건수는 입력 건수다', () => {
    const [row] = foldByDrop([a, b]);
    expect(row.kind === 'drop' && row.cards).toHaveLength(2);
  });
});
