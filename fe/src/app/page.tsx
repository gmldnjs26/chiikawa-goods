import { fetchHome } from '@/lib/api';
import { FilterableSections } from '@/modules/item/components/FilterableSections';

import { brandsOf, buildSection } from './home-sections';

/** 빌드 시점에 API가 없다 (CI). 요청마다 그린다 — fetch 캐시(lib/api.ts)가 API 부하를 막는다 */
export const dynamic = 'force-dynamic';

/** 섹션당 홈에 보이는 최대 건수. 넘치면 헤더의 `すべて ›`가 전용 페이지를 연다 */
const PREVIEW_LIMIT = 5;

/**
 * 홈 — 상태 우선 3섹션 (docs/plan.md §6.2). 섹션 소속은 API가 정했다 (docs/read-api.md §3.1).
 * 서버에서 한 번 받고, 카드도 서버에서 그려서 필터(클라이언트)에 `node`로 넘긴다.
 */
export default async function HomePage() {
  const home = await fetchHome();
  return (
    <FilterableSections
      brands={brandsOf(home)}
      previewLimit={PREVIEW_LIMIT}
      sections={[
        buildSection(home, 'now', true),
        buildSection(home, 'soon', true),
        buildSection(home, 'restock', true),
      ]}
    />
  );
}
