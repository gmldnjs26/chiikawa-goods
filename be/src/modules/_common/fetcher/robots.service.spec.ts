import { FetchError } from './errors/fetch.error';
import { HttpTransportService } from './http-transport.service';
import { RobotsService } from './robots.service';

/** 재시도가 같은 Response를 다시 읽으면 안 되므로 매번 새로 만든다 */
function responder(status: number, body: string): () => Promise<Response> {
  return () => Promise.resolve(new Response(body, { status }));
}

describe('RobotsService', () => {
  const fetchMock = jest.fn<Promise<Response>, [unknown, unknown?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  const service = () => new RobotsService(new HttpTransportService());

  it('Disallow된 경로를 막는다', async () => {
    fetchMock.mockImplementation(responder(200, 'User-agent: *\nDisallow: /api/\n'));
    const sut = service();

    expect(await sut.isAllowed(new URL('https://example.test/api/products'))).toBe(false);
    expect(await sut.isAllowed(new URL('https://example.test/collections/all/products.json'))).toBe(
      true,
    );
  });

  it('Crawl-delay를 읽는다', async () => {
    fetchMock.mockImplementation(responder(200, 'User-agent: *\nCrawl-delay: 10\n'));
    expect(await service().crawlDelaySec(new URL('https://example.test/a'))).toBe(10);
  });

  it('robots.txt가 404면 전부 허용이다', async () => {
    fetchMock.mockImplementation(responder(404, 'not found'));
    expect(await service().isAllowed(new URL('https://example.test/any'))).toBe(true);
  });

  it('5xx는 허용이 아니라 실패다 — 모르는 채로 때리지 않는다', async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementation(responder(503, 'oops'));
      // 5xx는 재시도 대상이라 백오프를 태워야 결론이 난다
      const pending = service()
        .isAllowed(new URL('https://example.test/any'))
        .catch((error: unknown) => error);
      await jest.advanceTimersByTimeAsync(60_000);

      expect(await pending).toBeInstanceOf(FetchError);
    } finally {
      jest.useRealTimers();
    }
  });

  it('호스트당 한 번만 받는다', async () => {
    fetchMock.mockImplementation(responder(200, 'User-agent: *\nDisallow:\n'));
    const sut = service();

    await sut.isAllowed(new URL('https://example.test/a'));
    await sut.isAllowed(new URL('https://example.test/b'));
    await sut.crawlDelaySec(new URL('https://example.test/c'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
