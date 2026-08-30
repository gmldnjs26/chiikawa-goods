/**
 * 로컬 픽스처 서버 (개발 전용).
 *
 * 저장된 응답을 HTTP로 돌려준다. `source.base_url`을 여기로 돌리면
 * `cli collect`가 **전 경로를 그대로 타면서 외부 요청은 0건**이다 —
 * robots 확인 · 호스트 간격 · 주기 게이트 · advisory lock · `collection_run` 기록까지.
 *
 * 프로덕션 코드에 테스트용 플래그를 넣지 않기 위한 장치다.
 *
 *   ./node_modules/.bin/ts-node -r tsconfig-paths/register scripts/fixture-server.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const PORT = 4010;
const ORIGIN = `http://localhost:${PORT}`;
const SLUG = 'chiikawamarket';
const FIXTURES = join(__dirname, '..', 'test', 'fixtures', SLUG);

/** 픽스처 안 URL은 실제 사이트를 가리킨다. 그대로 돌려주면 진짜 사이트로 나간다 */
function toLocal(body: string): string {
  return body.replace(/https:\/\/chiikawamarket\.jp/g, ORIGIN);
}

function read(name: string): string {
  return toLocal(readFileSync(join(FIXTURES, name), 'utf-8'));
}

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', ORIGIN).pathname;
  const send = (body: string, type: string) => {
    console.log(`  ${request.method} ${path} → 200`);
    response.writeHead(200, { 'Content-Type': type }).end(body);
  };

  if (path === '/robots.txt') return send('User-agent: *\nDisallow:\n', 'text/plain');
  if (path === '/sitemap.xml') return send(read('sitemap.xml'), 'application/xml');
  if (path.startsWith('/sitemap_collections')) {
    return send(read('sitemap_collections.xml'), 'application/xml');
  }

  const collection = /^\/collections\/([^/]+)\/products\.json$/.exec(path)?.[1];
  if (collection !== undefined) {
    const file = join(FIXTURES, `products-${collection}.json`);
    // 픽스처가 없는 컬렉션은 빈 목록. 실제로도 비어 있는 컬렉션이 있다
    const body = existsSync(file) ? readFileSync(file, 'utf-8') : '{"products":[]}';
    return send(body, 'application/json');
  }

  console.log(`  ${request.method} ${path} → 404`);
  response.writeHead(404).end('not found');
});

server.listen(PORT, () => {
  console.log(`픽스처 서버: ${ORIGIN}  (Ctrl+C로 종료)`);
});
