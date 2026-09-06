import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchHome } from '@/lib/api';
import { FilterableSections } from '@/modules/item/components/FilterableSections';

import { brandsOf, buildSection, isHomeSectionSlug } from '../home-sections';

export const dynamic = 'force-dynamic';

/** 전용 페이지에서 한 번에 보이는 건수 */
const PAGE_SIZE = 30;

/**
 * 섹션 전용 목록 — `/now` · `/soon` · `/restock`. 검색 유입 랜딩이 된다.
 * 탭 바 없음(NavTabs가 숨긴다), `‹ ホーム` 뒤로가기 + 같은 헤더 + 같은 필터. 상태 필터는 없다 — 이미 상태로 들어왔다.
 * 홈 응답이 섹션 전부를 갖고 있으므로 서버 요청은 홈과 같은 1번이다.
 */
export default async function SectionPage({ params }: PageProps<'/[section]'>) {
  const { section } = await params;
  if (!isHomeSectionSlug(section)) notFound();

  const home = await fetchHome();
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/"
        className="-mx-1 flex min-h-11 w-fit items-center gap-1 px-1 text-sm no-underline"
      >
        <span className="text-lg leading-none">‹</span> ホーム
      </Link>
      <FilterableSections
        brands={brandsOf(home)}
        pageSize={PAGE_SIZE}
        sections={[buildSection(home, section, false)]}
      />
    </div>
  );
}
