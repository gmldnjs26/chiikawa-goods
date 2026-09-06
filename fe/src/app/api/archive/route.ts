import { ApiError, fetchArchive } from '@/lib/api';

/**
 * 브라우저 → 읽기 API의 유일한 통로. 아카이브 「もっと見る」만 여기를 지난다 (fe/CLAUDE.md §4).
 * `API_BASE_URL`을 브라우저에 노출하지 않으려고 서버에서 중계한다. 커서는 해석하지 않고 그대로 넘긴다.
 */
export async function GET(request: Request) {
  const cursor = new URL(request.url).searchParams.get('cursor') ?? undefined;

  try {
    const page = await fetchArchive(cursor);
    return Response.json(page);
  } catch (error) {
    // 깨진 커서의 400을 그대로 돌려준다. 첫 페이지로 조용히 돌아가지 않는다 (docs/read-api.md §5.2)
    if (error instanceof ApiError) return Response.json(error.body, { status: error.status });
    throw error;
  }
}
