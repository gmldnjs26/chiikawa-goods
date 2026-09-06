import { fetchArchive } from '@/lib/api';
import { toJstCalendarDate } from '@/lib/format';
import { SectionHeader } from '@/modules/_common/components/Section';
import { ArchiveList } from '@/modules/item/components/ArchiveList';

/** 빌드 시점에 API가 없다 (CI). 요청마다 그린다 — fetch 캐시(lib/api.ts)가 API 부하를 막는다 */
export const dynamic = 'force-dynamic';

/** 過去・完売. 첫 페이지는 서버, 다음부터는 클라이언트 (fe/CLAUDE.md §4) */
export default async function ArchivePage() {
  const firstPage = await fetchArchive();
  // 아카이브 응답에는 today가 없다. ENDED 뱃지 판정은 날짜를 쓰지 않으므로 요청 시각의 JST 달력일로 충분하다
  const today = toJstCalendarDate(new Date().toISOString());

  return (
    <section className="flex flex-col gap-4 pt-2">
      <SectionHeader
        tone="ended"
        title="過去・完売"
        note="完売して再入荷の告知がないもの、再入荷未定と告知されたもの。新しい順。"
      />
      <ArchiveList firstPage={firstPage} today={today} />
    </section>
  );
}
