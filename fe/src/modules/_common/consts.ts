import type { Channel, ScheduleKind } from '@/lib/schema';

/**
 * 화면 어휘. 도메인 셋(홈 · 캘린더 · 아카이브)이 같이 쓰므로 `_common`에 있다 (fe/CLAUDE.md §2).
 * 문안은 전부 임시안 — 공개 전 톤 검수 (docs/plan.md §6.7).
 * 아이콘 · 이모지를 쓰지 않는다. 채널은 텍스트 라벨, 상태는 색 도트 (디자인 플랜 v1).
 */

/** 채널 표기. 순서는 `channelSchema` 선언 순서와 같다 (캘린더 정렬 순서) */
export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  online_official: '公式オンライン',
  konbini: 'コンビニ',
  arcade: 'プライズ',
  gacha: 'ガシャポン',
  kuji: 'くじ',
  store: '実店舗',
  apparel: 'アパレル',
};

/** 알려진 region만. 없는 값은 원문 그대로 보여준다 — 없는 정보를 만들지 않는다 */
export const REGION_LABELS: Readonly<Record<string, string>> = {
  online: 'オンライン',
  national: '全国',
  tokyo: '東京',
  osaka: '大阪',
};

export function regionLabel(region: string): string {
  return REGION_LABELS[region] ?? region;
}

export const SCHEDULE_KIND_LABELS: Readonly<Record<ScheduleKind, string>> = {
  preorder: '予約開始',
  release: '発売',
  restock: '再入荷',
};

/** 「N点」. 접힌 발표의 건수 표기 — 보이는 건수다, 발표 전체가 아니다 (§3.4) */
export function formatCount(count: number): string {
  return `${count}点`;
}

/** 브랜드 미판정 표기 (docs/plan.md §6.6). 목록에서 빼지 않는다 */
export const UNKNOWN_BRAND_LABEL = 'その他';
/** 시리즈 없음 표기. 브랜드와 값이 같지만 따로 둔다 — 한쪽 문안을 바꿔도 다른 쪽이 따라가지 않게 */
export const UNKNOWN_SERIES_LABEL = 'その他';
/** 필터 칩에서 미판정 브랜드를 가리키는 키. 실제 brand code와 겹치지 않는 값 */
export const UNKNOWN_BRAND_CODE = '_unknown';

/** 이미지 빈칸에 넣는 브랜드 이니셜 1자. 깨진 게 아니라 라벨이 있는 빈칸 */
const BRAND_INITIALS: Readonly<Record<string, string>> = {
  chiikawa_market: '市',
  nagano_market: 'ナ',
  pocket: 'ポ',
  mogumogu: 'も',
  ichiban_kuji: 'く',
};

export function brandInitial(brand: { code: string; label: string } | null): string {
  if (brand === null) return '他';
  return BRAND_INITIALS[brand.code] ?? brand.label.slice(0, 1);
}

/** 개시 시각은 추정치다 (docs/plan.md §3.4). 확정인 척하지 않는다 — 점선 밑줄 */
export const TIME_ESTIMATED_LABEL = '時刻は推定';
export const TIME_ESTIMATED_TITLE = '開始時刻はサイトに記載がないため、実測をもとにした推定です';

/** 오류 · 삭제 요청 · 判定不可 報告의 목적지 */
export const ISSUES_URL = 'https://github.com/gmldnjs26/chiikawa-goods/issues';

/** 테마 저장 키. `layout.tsx` 인라인 스크립트와 `ThemeToggle`이 같이 쓴다 — 서버 · 클라이언트 양쪽에서 import하므로 여기 */
export const THEME_STORAGE_KEY = 'theme';

/** 서비스명. 미정 — 가제 (docs/plan.md §10 #1) */
export const SITE_NAME = 'ちいかわグッズ タイムライン';
