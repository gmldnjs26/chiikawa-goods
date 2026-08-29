import { BlockedError, CollectError } from './http.errors';
import { HttpFetcherService } from './http-fetcher.service';
import { HttpTransportService } from './http-transport.service';
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

  const sut = () => {
    const transport = new HttpTransportService();
    return new HttpFetcherService(new RobotsService(transport), transport);
  };

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

describe('HttpFetcherService — 리다이렉트와 차단 판정', () => {
  const fetchMock = jest.fn<Promise<Response>, [unknown, unknown?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  const sut = () => {
    const transport = new HttpTransportService();
    return new HttpFetcherService(new RobotsService(transport), transport);
  };

  /** 호스트별 robots.txt와 응답을 URL로 라우팅한다 */
  const route = (handlers: Array<[RegExp, () => Response]>) => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input);
      const found = handlers.find(([pattern]) => pattern.test(url));
      if (!found) throw new Error(`라우트 없음: ${url}`);
      return Promise.resolve(found[1]());
    });
  };

  it('리다이렉트 종착지가 robots에 막혀 있으면 따라가지 않는다', async () => {
    route([
      [/a\.test\/robots\.txt/, () => new Response('User-agent: *\nDisallow:\n', { status: 200 })],
      [/b\.test\/robots\.txt/, () => new Response('User-agent: *\nDisallow: /x\n', { status: 200 })],
      [/a\.test\/start/, () => new Response('', { status: 302, headers: { location: 'https://b.test/x' } })],
      [/b\.test\/x/, () => new Response('도달하면 안 된다', { status: 200 })],
    ]);

    await expect(sut().fetchText('https://a.test/start', { crawlDelaySec: 0 })).rejects.toThrow(
      /robots.txt가 막은 경로/,
    );
    // 종착지 본문 요청이 나가지 않았다
    expect(fetchMock.mock.calls.map(([url]) => String(url)).includes('https://b.test/x')).toBe(false);
  });

  it('503 + 챌린지 마커는 재시도하지 않는다 — 본문 뒤쪽에 있어도 잡는다', async () => {
    // 챌린지는 HTML 인터스티셜로 온다. 마커는 본문 뒤쪽에 있다
    const challenge = `<!DOCTYPE html><html><body>${'대기 '.repeat(900)}cf-browser-verification</body></html>`;
    route([
      [/robots\.txt/, () => new Response('User-agent: *\nDisallow:\n', { status: 200 })],
      [/\/a$/, () => new Response(challenge, { status: 503 })],
    ]);

    await expect(sut().fetchText('https://a.test/a', { crawlDelaySec: 0 })).rejects.toThrow(
      BlockedError,
    );
    // robots 1 + 본요청 1. 재시도가 없다
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Retry-After가 백오프 예산보다 길면 그 실행을 포기한다', async () => {
    route([
      [/robots\.txt/, () => new Response('User-agent: *\nDisallow:\n', { status: 200 })],
      [/\/a$/, () => new Response('busy', { status: 503, headers: { 'retry-after': '120' } })],
    ]);

    await expect(sut().fetchText('https://a.test/a', { crawlDelaySec: 0 })).rejects.toThrow(
      BlockedError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('robots.txt에 온 403은 차단이다 — 소스를 내려야 한다', async () => {
    route([[/robots\.txt/, () => new Response('denied', { status: 403 })]]);

    const error = await sut()
      .fetchText('https://a.test/a', { crawlDelaySec: 0 })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BlockedError);
    expect((error as BlockedError).shouldDisableSource).toBe(true);
  });
});
