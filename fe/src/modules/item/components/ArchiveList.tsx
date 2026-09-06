'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

import { type ArchiveResponse, parseArchive } from '@/lib/schema';
import { EmptyState, GroupedList, RowDivider } from '@/modules/_common/components/Section';

import { ItemCard } from './ItemCard';

/**
 * 아카이브 페이지네이션. **v0에서 TanStack Query를 쓰는 유일한 곳**이다 (fe/CLAUDE.md §4).
 * 첫 페이지는 서버가 받아서 `initialData`로 넣는다. 다음 페이지만 브라우저에서 `app/api/archive`를 거쳐 받는다.
 * 커서는 불투명 문자열이다. 저장했다가 그대로 돌려준다 (docs/read-api.md §5.2).
 * 3상태: 읽는 중(스피너) / 마지막(텍스트 1줄) / 실패(문구 + もう一度試す). 총 건수는 API에 없어 `残り N`을 내지 않는다.
 */
export function ArchiveList({ firstPage, today }: { firstPage: ArchiveResponse; today: string }) {
  const query = useInfiniteQuery({
    queryKey: ['archive'],
    initialPageParam: null as string | null,
    initialData: { pages: [firstPage], pageParams: [null] },
    queryFn: async ({ pageParam }) => {
      const url = new URL('/api/archive', window.location.origin);
      if (pageParam !== null) url.searchParams.set('cursor', pageParam);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`archive ${response.status}`);
      return parseArchive(await response.json());
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const items = query.data.pages.flatMap((page) => page.items);

  if (items.length === 0) return <EmptyState>該当なし</EmptyState>;

  return (
    <>
      <GroupedList>
        {items.map((card, index) => (
          <div key={card.id}>
            {index > 0 && <RowDivider />}
            <ItemCard card={card} today={today} />
          </div>
        ))}
      </GroupedList>

      {query.isError ? (
        <div className="flex flex-col items-center gap-2.5" role="alert">
          <p className="text-sm text-label-secondary">読み込みに失敗しました</p>
          <button
            type="button"
            onClick={() => void query.fetchNextPage()}
            className="flex min-h-11 items-center rounded-lg border border-label bg-surface px-5 text-sm font-semibold text-label"
          >
            もう一度試す
          </button>
        </div>
      ) : query.isFetchingNextPage ? (
        <div className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-separator bg-surface text-sm text-label-secondary">
          <span
            aria-hidden
            className="inline-block size-3.5 animate-spin rounded-full border-2 border-border border-t-label-secondary"
          />
          読み込み中…
        </div>
      ) : query.hasNextPage ? (
        <button
          type="button"
          onClick={() => void query.fetchNextPage()}
          className="flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface text-sm font-semibold text-label"
        >
          もっと見る
        </button>
      ) : (
        <p className="flex min-h-11 items-center justify-center text-sm text-label-secondary">
          これ以上はありません
        </p>
      )}
    </>
  );
}
