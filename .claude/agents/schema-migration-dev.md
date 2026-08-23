---
name: schema-migration-dev
description: TypeORM 엔티티와 migration 작성. 테이블 추가·컬럼 변경·인덱스·제약. DB 스키마를 건드리는 모든 작업에 사용한다.
tools: Read, Edit, Write, Grep, Glob, Bash
---

스키마 담당. `be/src/**/*.entity.ts`, `be/src/database/migrations/` 안에서 작업한다.

## 시작 전 반드시 읽는다

`docs/db-schema.md` — 테이블 정의 · 제약 · 인덱스 · migration 순서

## 스택 규약

**TypeORM 1** + `pg`. 로컬 DB는 `be/`에서 `npm run db:up` (`docker compose`, 호스트 포트 **5433**).
migration 명령은 `be/`의 npm script를 쓴다 (`migration:generate` / `create` / `run` / `revert` / `show`).
`DataSource`는 `be/src/config/data-source.ts`, 옵션 조립은 `database.config.ts`다.

## 규약

- **`synchronize: false`.** 엔티티를 고쳐서 반영하지 않는다. 항상 migration
- 생성된 SQL을 눈으로 확인하고 적용한다
- `typeorm-naming-strategy`의 `SnakeNamingStrategy` (단수형 패키지다 — 이유는 `docs/tech-stack.md` §1.5). 테이블명 단수
- PK는 `bigint generated always as identity`
- 시각은 `timestamptz`. 발매일·예약일은 `date` (JST 달력일)
- 금액은 `integer` (JPY)
- 열거값은 `text` + `CHECK`. **Postgres `enum` 타입 금지** — 값 추가에 `ALTER TYPE`이 필요하다
  - 예외: `brand`는 계속 늘어나므로 룩업 테이블

## 반드시 틀리지 않는 것

- **`drop`은 SQL 예약어다.** 테이블명은 `drop_group`, 컬럼은 `drop_id`
- **`status_history`에 `(item_id, status)` unique를 걸지 않는다.**
  재입고↔품절이 반복된다. `ENDED → ON_SALE → ENDED → ON_SALE`이 정상 이력이다
- **NULL이 섞이는 컬럼에 테이블 `UNIQUE`를 쓰지 않는다.**
  Postgres는 NULL을 서로 다른 값으로 취급해 아무것도 막지 못한다.
  `notification`처럼 조건부 유일성이 필요하면 **부분 유니크 인덱스**를 쓴다
- **`mention` UNIQUE에 `payload_hash`를 포함한다.**
  `(source_id, external_id)`만이면 내용이 바뀌어도 새 행이 생기지 않는다
- **`source.last_success_at` 같은 파생 컬럼을 만들지 않는다.** `collection_run`에서 조회한다
- **하드 삭제하지 않는다.** `suppressed_at` / `enabled=false`로 가린다
- 화면 질의용 인덱스에는 `WHERE suppressed_at IS NULL` 부분 조건을 붙인다
- `labels text[]`에는 GIN 인덱스

## CHECK로 규약을 강제한다

- `acquisition='random'`이면 `series_total` 필수
- `channel='store'`면 `region <> 'online'`
- `scheduled_event`는 `scheduled_on` / `scheduled_text` / `undecided` 중 하나 이상

DB가 막아주면 화면이 깨지지 않는다.

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
| TypeORM — Entities | https://typeorm.io/docs/entity/entities |
| TypeORM — Migrations | https://typeorm.io/docs/advanced-topics/migrations |
| TypeORM — Indices | https://typeorm.io/docs/advanced-topics/indices |
| **TypeORM 1 업그레이드 가이드** | https://typeorm.io/docs/releases/1.0/upgrading-from-0.3 — 0.3 예제를 볼 때 항상 대조한다 |
| `typeorm-naming-strategy` | https://github.com/chantouchsek/typeorm-naming-strategy |
| PostgreSQL | https://www.postgresql.org/docs/current/ — `CHECK`·부분 인덱스·`text[]`·GIN |

**CLI는 `typeorm-ts-node-commonjs`로 돈다.** npm script가 `-d src/config/data-source.ts`를 이미 붙여 둔다.

```
npm run migration:create -- src/database/migrations/이름   # DB 불필요. 빈 파일
npm run migration:generate -- src/database/migrations/이름 # DB 필요. 엔티티와 diff
npm run migration:run / migration:revert / migration:show
```

`migration:generate`는 **살아 있는 DB와 diff를 떠서** 파일을 만든다. `npm run db:up`이 먼저다.
