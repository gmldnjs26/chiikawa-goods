import { BlockedError, CollectError } from './http.errors';
import { HttpFetcherService } from './http-fetcher.service';
import { RobotsService } from './robots.service';

const ALLOW_ALL = 'User-agent: *\nDisallow:\n';

describe('HttpFetcherService', () => {
  const fetchMock = jest.fn<Promise<Response>, [unknown, unknown?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  /** 첫 호출은 robots.txt다. 그 뒤가 본 요청이다 */
  const withRobots = (robotsBody: string, ...rest: Response[]) => {
    fetchMock.mockResolvedValueOnce(new Response(robotsBody, { status: 200 }));
    rest.forEach((response) => fetchMock.mockResolvedValueOnce(response));
  };

  const sut = () => new HttpFetcherService(new RobotsService());

  it('robots.txt가 막은 경로는 호출조차 하지 않는다', async () => {
    withRobots('User-agent: *\nDisallow: /api/\n');

    await expect(
      sut().fetchText('https://example.test/api/products', { crawlDelaySec: 0 }),
    ).rejects.toThrow(/robots.txt가 막은 경로/);

    // robots.txt 1회뿐 — 본 요청은 나가지 않았다
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('403은 차단으로 보고 재시도하지 않는다', async () => {
    withRobots(ALLOW_ALL, new Response('denied', { status: 403 }));

    await expect(sut().fetchText('https://example.test/a', { crawlDelaySec: 0 })).rejects.toThrow(
      BlockedError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('200이어도 챌린지 본문이면 차단이다', async () => {
    withRobots(ALLOW_ALL, new Response('<html><title>Just a moment...</title>', { status: 200 }));

    const error = await sut()
      .fetchText('https://example.test/a', { crawlDelaySec: 0 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BlockedError);
    expect((error as CollectError).failureKind).toBe('blocked');
  });

  it('404는 재시도하지 않는다', async () => {
    withRobots(ALLOW_ALL, new Response('nope', { status: 404 }));

    await expect(sut().fetchText('https://example.test/a', { crawlDelaySec: 0 })).rejects.toThrow(
      /HTTP 404/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('5xx는 백오프를 두고 재시도하고, 끝내 실패하면 던진다', async () => {
    jest.useFakeTimers();
    try {
      withRobots(
        ALLOW_ALL,
        new Response('x', { status: 500 }),
        new Response('x', { status: 500 }),
        new Response('x', { status: 500 }),
      );

      const pending = sut()
        .fetchText('https://example.test/a', { crawlDelaySec: 0 })
        .catch((error: unknown) => error);

      await jest.advanceTimersByTimeAsync(60_000);
      expect(await pending).toBeInstanceOf(CollectError);
      // robots 1 + 시도 3
      expect(fetchMock).toHaveBeenCalledTimes(4);
    } finally {
      jest.useRealTimers();
    }
  });

  it('User-Agent에 연락처를 실어 보낸다', async () => {
    withRobots(ALLOW_ALL, new Response('{}', { status: 200 }));
    await sut().fetchText('https://example.test/a', { crawlDelaySec: 0 });

    const headers = (fetchMock.mock.calls[1][1] as { headers: Record<string, string> }).headers;
    expect(headers['User-Agent']).toMatch(/^chiikawa-goods-bot\/[\d.]+ \(\+https:\/\//);
  });
});
