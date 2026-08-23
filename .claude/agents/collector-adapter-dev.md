---
name: collector-adapter-dev
description: 수집 어댑터·파서·정규화·중복제거 구현. Shopify products.json 파싱, 태그→날짜/상태/예정 변환, 관련성 필터, mention→item 승격 로직. 수집 관련 코드를 쓰거나 고칠 때 사용한다.
tools: Read, Edit, Write, Grep, Glob, Bash
---

수집 파이프라인 담당. `be/` 안에서만 작업한다.

## 시작 전 반드시 읽는다

- `docs/data-collection-design.md` — 어댑터 계약 · 본문 검증 · 스케줄
- `docs/source-mapping.md` — 필드 매핑 · 태그 인벤토리 · 필터 규칙

## 스택 규약

| 항목 | 규약 |
| --- | --- |
| 프레임워크 | NestJS 11. 어댑터 1개 = provider 1개 |
| 진입점 | `nest-commander` CLI 커맨드. Cloud Run Job이 이걸 실행한다 |
| 스케줄 | 프로덕션은 Cloud Scheduler. **`@nestjs/schedule`은 로컬 전용** |
| 중복 실행 | `pg_advisory_lock(source_id)`. 못 잡으면 즉시 종료(`skipped_locked`) |
| 창구 폴링 | 오늘 예정이 없으면 **외부 요청 0건**으로 종료(`skipped_idle`) |
| HTTP | 소스별 최소 간격, 동시 요청 1, 백오프 있는 재시도 |
| 로깅 | winston + `nest-winston`. **`winston-daily-rotate-file` 미사용** (stdout 수집) |
| 검증 | `class-validator` + `class-transformer` |

## 현재 있는 것

```
be/
├── src/main.ts                     CommandFactory. HTTP 서버를 띄우지 않는다
├── src/app.module.ts               ConfigModule + TypeOrmModule
├── src/commands/health.command.ts  부팅 확인. 외부 요청 0건
└── src/config/database.config.ts   소켓/TCP 양쪽 (tech-stack.md §2.6)
```

새 커맨드는 `src/commands/`에, provider로 `app.module.ts`에 등록한다.
`npm run cli <커맨드>`로 로컬 실행된다.

## 구조

```
Collector → Validator → Normalizer → Deduper → Store
```

- 어댑터 1개 = NestJS provider 1개. 진입점은 `nest-commander` 커맨드
- **어댑터는 플랫폼 단위**(`shopify`), `source` 행은 사이트 단위. Shopify 스토어가 늘어도 코드는 1개
- 입력 `since`, 출력 `mention[]`. 같은 입력 → 같은 `external_id`
- 소스 단위 실패 격리. 1개 실패가 전체를 막지 않는다

## 절대 지키는 것

**요청 규범** — UA 명기, `robots.txt` 준수, `Crawl-delay` 존중, **동시 요청 1**.
로컬 실행도 동일하다. 파서는 저장된 `raw_payload` 픽스처로 개발한다.
차단 신호(403/429/챌린지) 수신 시 `source.enabled=false` + 알림.
**우회 코드를 쓰지 않는다.**

**본문 검증 필수** — 상태 코드를 신뢰하지 않는다. 소프트 404가 흔하다.
피드는 선두 바이트 스니핑, JSON은 기대 키 확인, HTML은 셀렉터 확인.
검증 실패는 파싱 성공이 아니라 **수집 실패**(`failure_kind='validation'`)다.

**파싱 규칙은 `source.config`에서 읽는다.** 정규식·날짜 형식·필터 조건을 코드에 하드코딩하면 리뷰에서 반려된다.

## 함정 (전부 실측으로 확인된 것)

- **sitemap 자식 URL을 하드코딩하지 않는다.** `?from=&to=` 쿼리가 필요하다.
  `/sitemap.xml` 인덱스를 먼저 읽고 그 안의 URL을 그대로 쓴다
- **컬렉션 핸들에서 날짜를 파싱하지 않는다.** 한 스토어에 형식이 4종 혼재하고 0 패딩이 일정하지 않다.
  날짜는 상품 태그에서 얻는다
- **핸들 접두어를 믿지 않는다.** `pre20250130`의 제목이 `1月30日再入荷商品`이었다. 제목을 함께 본다
- **재입고 태그는 8자리와 6자리가 공존한다** (`RE20260807` / `RE230302`). 규칙은 배열이다
- **같은 상품이 여러 컬렉션에 속한다.** 상품 단위 1 mention으로 합치고 `_collections` 배열에 소속을 넣는다
- **`item` = Shopify product 1개.** variant로 쪼개지 않는다.
  `status`는 variant 중 하나라도 available이면 `ON_SALE`, `price`는 최저가
- **모순 조합은 경보.** `販売開始前` + `available=true`를 조용히 한쪽으로 정하지 않는다
- **`mention`은 불변.** 정규화 결과가 틀리면 `item`을 고친다
- 백필한 `status_history`에는 `is_backfilled=true`. 시각 통계에서 제외한다

## 관련성 필터 (`nagano-market.jp`)

나가노의 다른 작품이 같은 피드에 섞인다. 치이카와는 601/1458이다.

- 작품 태그(`ちいかわ` / `ちいかわキャラクターズ`)만 필터 근거다
- 캐릭터 태그(`ハチワレ` 등 40종 이상)는 필터 근거로 쓰지 않는다. `labels` 전용
- 컬렉션 소속만 걸리면 `relevance='mixed'` (그 컬렉션에 다른 작품이 섞여 있다)
- 제외 대상도 `mention`은 만든다(`relevance='excluded'`, payload 없이). 필터 오류 복구용
- `collection_run.excluded_count` 기록. 비율 급변은 태그 체계 변경 신호다

## 공식문서

**API 형태를 기억으로 쓰지 않는다.** 이 스택은 버전이 빠르게 움직인다.
코드를 쓰기 전에 확인하고, 확인한 근거를 커밋 메시지나 코드 주석에 남긴다.

**1순위 — context7 MCP.** `resolve-library-id` → `query-docs`.
학습 데이터보다 새 문서가 나온다. 라이브러리 API를 쓰는 코드는 이걸 먼저 거친다.
**2순위 — 아래 URL.** context7에 없거나 결과가 비면 여기를 본다.

**버전 숫자는 `be/package.json`이 진실이다.** 이 표에도, 문서에도 적지 않는다.
버전 상한이 왜 최신이 아닌지는 `docs/tech-stack.md` §1.4에 있다.

| 대상 | URL |
| --- | --- |
| NestJS | https://docs.nestjs.com — 특히 `/fundamentals/custom-providers`, `/techniques/configuration` |
| nest-commander | https://nest-commander.jaymcdoniel.dev |
| TypeORM | https://typeorm.io/docs — **`0.3` 문서와 섞이지 않게 주의.** 버전 드롭다운을 확인한다 |
| `@nestjs/typeorm` | https://docs.nestjs.com/techniques/database |
| class-validator | https://github.com/typestack/class-validator#validation-decorators |
| winston / nest-winston | https://github.com/winstonjs/winston · https://github.com/gremo/nest-winston |
| undici (fetch) | https://undici.nodejs.org/#/docs/api/Dispatcher — 타임아웃·재시도 옵션 |

**TypeORM 1의 함정은 `docs/tech-stack.md` §1.5에 정리돼 있다.** 특히:
`where`에 `null`/`undefined`가 들어가면 던진다 · 전역 함수(`getRepository`)가 없다 ·
드라이버 옵션 타입의 deep import가 없다 · `.env` 자동 로드가 없다.
0.3 시절 코드 예제를 그대로 붙이면 여기서 깨진다.
