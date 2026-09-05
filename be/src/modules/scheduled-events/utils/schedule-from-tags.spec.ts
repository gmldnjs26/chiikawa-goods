import { sameContent, schedulesFromTags, ScheduleSource } from './schedule-from-tags';

const observed = new Date('2026-08-30T18:38:25+09:00');

function source(over: Partial<ScheduleSource> = {}): ScheduleSource {
  return { status: 'ENDED', preorderOn: null, releaseOn: null, restockDates: [], ...over };
}

describe('schedulesFromTags', () => {
  // 실측: 販売開始前 + 予約 + PRE20260826 + available:false 조합
  it('販売開始前 + 미래 예약 태그 → preorder', () => {
    const result = schedulesFromTags(
      source({ status: 'UPCOMING', preorderOn: '2026-09-10' }),
      observed,
    );

    expect(result.preorder).toEqual({
      scheduledOn: '2026-09-10',
      scheduledText: null,
      undecided: false,
    });
    expect(result.release).toBeNull();
    expect(result.restock).toBeNull();
  });

  // 판매 중인 상품의 예약 태그는 과거 이력이지 예정이 아니다
  it('UPCOMING이 아니면 예약 태그가 미래여도 preorder가 아니다', () => {
    const result = schedulesFromTags(
      source({ status: 'ON_SALE', preorderOn: '2026-09-10' }),
      observed,
    );
    expect(result.preorder).toBeNull();
  });

  it('미래 발매 태그 → release. 상태와 무관하다', () => {
    expect(
      schedulesFromTags(source({ status: 'ON_SALE', releaseOn: '2026-09-01' }), observed).release,
    ).toEqual({ scheduledOn: '2026-09-01', scheduledText: null, undecided: false });
  });

  // 「미래」는 관측 시각 기준이다. 정규화를 다시 돌려도 같아야 한다
  it('과거·당일 날짜는 예정이 아니다', () => {
    const result = schedulesFromTags(
      source({ status: 'UPCOMING', preorderOn: '2026-08-30', releaseOn: '2026-07-10' }),
      observed,
    );
    expect(result.preorder).toBeNull();
    expect(result.release).toBeNull();
  });

  // 재입고 태그는 누적된다. 과거는 백필, 미래 중 가장 가까운 것 하나가 예정이다
  it('재입고는 미래 중 가장 가까운 날짜 하나', () => {
    const result = schedulesFromTags(
      source({ restockDates: ['2023-12-21', '2026-09-20', '2026-09-05'] }),
      observed,
    );
    expect(result.restock?.scheduledOn).toBe('2026-09-05');
  });

  it('태그가 없으면 셋 다 null', () => {
    expect(schedulesFromTags(source(), observed)).toEqual({
      preorder: null,
      release: null,
      restock: null,
    });
  });
});

describe('sameContent', () => {
  it('세 필드가 전부 같아야 같다', () => {
    const a = { scheduledOn: '2026-09-05', scheduledText: null, undecided: false };
    expect(sameContent(a, { ...a })).toBe(true);
    expect(sameContent(a, { ...a, scheduledOn: '2026-09-06' })).toBe(false);
    expect(sameContent(a, { ...a, undecided: true })).toBe(false);
  });
});
