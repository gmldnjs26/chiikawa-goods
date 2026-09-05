import { normalizeTitle, parseSeriesTotal, toHalfWidth } from './title-normalize';

describe('toHalfWidth', () => {
  it('전각 영숫자와 공백만 바꾼다', () => {
    expect(toHalfWidth('ＢＯＸ７　個')).toBe('BOX7 個');
  });

  // 반각 가나로 바꾸면 표기가 갈린다. 실측 제목은 전부 전각 가나다
  it('가나와 한자는 건드리지 않는다', () => {
    expect(toHalfWidth('ハチワレ 映画')).toBe('ハチワレ 映画');
  });
});

describe('normalizeTitle', () => {
  it('괄호와 공백을 없앤다', () => {
    expect(normalizeTitle('ちいかわ　マスコット（ハチワレ）')).toBe('ちいかわマスコットハチワレ');
  });

  it('접두어를 뗀다 — 같은 굿즈에 붙는 수식이다', () => {
    expect(normalizeTitle('【予約】ちいかわ マスコット')).toBe('ちいかわマスコット');
  });

  it('접두어가 겹쳐 붙어도 전부 뗀다', () => {
    expect(normalizeTitle('【予約】【再入荷】ちいかわ')).toBe('ちいかわ');
  });

  // 같은 상품의 예약분과 재입고분이 한 item으로 모여야 한다
  it('수식만 다른 제목이 같은 값이 된다', () => {
    expect(normalizeTitle('【予約】ちいかわ マスコット（全７種）')).toBe(
      normalizeTitle('ちいかわマスコット(全7種)'),
    );
  });
});

describe('parseSeriesTotal', () => {
  // 실측: 伏見店限定 トレーディング アクリルスタンド（全７種ＢＯＸ）
  it('전각 숫자를 읽는다', () => {
    expect(parseSeriesTotal('アクリルスタンド（全７種ＢＯＸ）')).toBe(7);
  });

  it('반각도 읽는다', () => {
    expect(parseSeriesTotal('全12種')).toBe(12);
  });

  it('없으면 null — 랜덤 판정의 근거가 없다는 뜻이다', () => {
    expect(parseSeriesTotal('ちいかわ マスコット')).toBeNull();
  });
});
