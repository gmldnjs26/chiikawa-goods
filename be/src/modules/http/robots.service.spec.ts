import { CollectError } from './http.errors';
import { RobotsService } from './robots.service';

function respond(status: number, body: string): Response {
  return new Response(body, { status });
}

describe('RobotsService', () => {
  const fetchMock = jest.fn<Promise<Response>, [unknown, unknown?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  const service = () => new RobotsService();

  it('Disallow된 경로를 막는다', async () => {
    fetchMock.mockResolvedValue(respond(200, 'User-agent: *\nDisallow: /api/\n'));
    const sut = service();

    expect(await sut.isAllowed(new URL('https://example.test/api/products'))).toBe(false);
    expect(await sut.isAllowed(new URL('https://example.test/collections/all/products.json'))).toBe(
      true,
    );
  });

  it('Crawl-delay를 읽는다', async () => {
    fetchMock.mockResolvedValue(respond(200, 'User-agent: *\nCrawl-delay: 10\n'));
    expect(await service().crawlDelaySec(new URL('https://example.test/a'))).toBe(10);
  });

  it('robots.txt가 404면 전부 허용이다', async () => {
    fetchMock.mockResolvedValue(respond(404, 'not found'));
    expect(await service().isAllowed(new URL('https://example.test/any'))).toBe(true);
  });

  it('5xx는 허용이 아니라 실패다 — 모르는 채로 때리지 않는다', async () => {
    fetchMock.mockResolvedValue(respond(503, 'oops'));
    await expect(service().isAllowed(new URL('https://example.test/any'))).rejects.toThrow(
      CollectError,
    );
  });

  it('호스트당 한 번만 받는다', async () => {
    fetchMock.mockResolvedValue(respond(200, 'User-agent: *\nDisallow:\n'));
    const sut = service();

    await sut.isAllowed(new URL('https://example.test/a'));
    await sut.isAllowed(new URL('https://example.test/b'));
    await sut.crawlDelaySec(new URL('https://example.test/c'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
