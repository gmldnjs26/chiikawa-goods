import {
  type ArchiveResponse,
  type CalendarResponse,
  type HomeResponse,
  parseArchive,
  parseCalendar,
  parseHome,
} from './schema';

/**
 * 읽기 API 호출. **서버 컴포넌트 · 라우트 핸들러 전용**이다 — `API_BASE_URL`은 브라우저에 노출하지 않는다.
 * 브라우저에서 나가는 요청은 아카이브 페이지네이션뿐이고 `app/api/archive`를 거친다 (fe/CLAUDE.md §4).
 *
 * `API_BASE_URL=fixture`면 `test/fixtures/*.json`을 읽는다. API 없이 화면을 그리는 개발용이다 (#13).
 */
const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3001';

/** 수집이 30분 주기다. 화면이 그보다 자주 갱신될 이유가 없다 (fe/CLAUDE.md §3) */
const REVALIDATE_SECONDS = 600;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    readonly body: unknown,
  ) {
    super(`API ${status} ${path}`);
  }
}

export async function fetchHome(): Promise<HomeResponse> {
  return parseHome(await getJson('/home', {}, 'home'));
}

export async function fetchCalendar(from?: string, to?: string): Promise<CalendarResponse> {
  return parseCalendar(await getJson('/calendar', { from, to }, 'calendar'));
}

export async function fetchArchive(cursor?: string, limit?: number): Promise<ArchiveResponse> {
  return parseArchive(await getJson('/archive', { cursor, limit: limit?.toString() }, 'archive'));
}

async function getJson(
  path: string,
  params: Record<string, string | undefined>,
  fixtureName: string,
): Promise<unknown> {
  if (BASE_URL === 'fixture') {
    // 픽스처는 한 페이지뿐이다. 커서가 오면 마지막 페이지
    if (params.cursor !== undefined)
      return { generatedAt: new Date().toISOString(), items: [], nextCursor: null };
    return readFixture(fixtureName);
  }

  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, url.pathname + url.search, body);
  return body;
}

async function readFixture(name: string): Promise<unknown> {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const file = path.join(process.cwd(), 'test', 'fixtures', `${name}.json`);
  console.warn(`[api] API_BASE_URL=fixture — ${file}`);
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}
