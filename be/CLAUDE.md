# be/ 아키텍처 규칙

`be/` 안의 모든 작업에 적용된다. **여기 없는 구조를 즉흥으로 만들지 않는다.**

## 이 문서의 담당 범위

| 문서 | 담당 |
| --- | --- |
| **`be/CLAUDE.md`** (이 문서) | **디렉토리 · 레이어 경계 · 진입점 · 스키마 변경 절차** |
| `.claude/agents/collector-adapter-dev.md` | 수집 규범 · 실측 함정 · **공식문서 URL** |
| `.claude/agents/schema-migration-dev.md` | 엔티티·migration 작성 규약 · **공식문서 URL** |
| `docs/data-collection-design.md` | 데이터 3층 · 어댑터 계약 · 스케줄 |
| `docs/db-schema.md` | 테이블과 제약의 **이유** |
| `docs/tech-stack.md` | 기술 선정 근거 · 버전 상한 · TypeORM 1 함정 (§1.5) |

같은 규칙을 두 곳에 쓰지 않는다. **URL은 에이전트에만 둔다** — 여기 복사하지 않는다.
수집 정책·태그 함정 질문은 `collector-adapter-dev.md`로 간다.

---

## 1. 진입점은 CLI다. HTTP 서버가 아니다

`src/main.ts`는 `CommandFactory.run()`이다. **`listen()`이 없다.**
Cloud Run Job이 커맨드 하나를 실행하고 프로세스가 끝난다.

```
npm run cli <커맨드>     로컬. ts-node로 src/main.ts 직접 실행
node dist/main <커맨드>  프로덕션. nest build 결과
```

- **커맨드는 끝나야 한다.** 끝나지 않는 커맨드는 Job에서 과금이 멈추지 않는다
- 상주 서버가 필요한 건 읽기 API뿐이다 (에픽 E). **그건 별 진입점이고 Job과 섞지 않는다**
- 진단 커맨드(`health`)는 **외부 요청 0건**이어야 한다

## 2. 디렉토리

`tomomachi-be`와 같은 배치다. 혼자 두 코드베이스를 오간다.

```
be/src/
├── main.ts                 CommandFactory. HTTP 서버를 띄우지 않는다
├── app.module.ts           ConfigModule + TypeOrmModule + 도메인 모듈
├── commands/               진단용 커맨드
├── config/                 DataSource · 환경변수
├── migrations/             migration. 평면. 하위 디렉토리 없음
├── modules/
│   ├── _common/            도메인 없는 공유물
│   │   └── <인프라>/       provider를 갖는 공유 모듈은 역할별로 나눈다 (아래)
│   └── <도메인>/
│       ├── entities/*.entity.ts
│       ├── *.service.ts
│       └── <도메인>.module.ts
└── batch/<잡>/             nest-commander 배치 잡. 락 · 실행 기록 · 게이트 · 순회
```

- **엔티티는 도메인 모듈 안에 둔다.** `database/entities/` 같은 **레이어 분할을 하지 않는다**
- 디렉토리명은 **복수**, 테이블명은 **단수** (`modules/sources/` ↔ `source`)
- **빈 `.module.ts`를 미리 만들지 않는다.** provider가 생길 때 만든다.
  엔티티만 있는 도메인은 `entities/`만 있으면 된다
- `TypeOrmModule.forFeature`는 **쓰는 모듈이** 등록한다. 전역 레포 모듈을 만들지 않는다

### `_common/` 아래 인프라 모듈

도메인이 아니라 **기술적 관심사**를 담는 모듈이다 (`_common/fetcher/` = 외부 요청).
파일이 10개를 넘으면 **역할별로** 나눈다. 도메인 모듈의 평면 배치와 다르다.

```
_common/<인프라>/
├── dto/           입출력 형태. `*.dto.ts`
├── errors/        예외와 그 종류. `*.error.ts`
├── utils/         상태 없는 순수 함수 · 작은 클래스
├── *.service.ts   provider
└── <이름>.module.ts
```

- **`controller/`도 `entities/`도 없다.** 라우트가 없고(진입점이 CLI다 §1) 테이블도 없다.
  읽기 API를 만들 때 그쪽 모듈에 `controller`·`dto`가 생긴다
- **`dto/`는 클래스가 아니라 `interface`다.** `class-validator`는 HTTP 요청 본문을 검증할 때
  쓴다. 여기 값은 우리가 만들어 넘기는 것이라 검증할 경계가 아니다
- **`_common/`은 특정 도메인을 모른다.** 도메인 타입을 import하면 의존 방향이 뒤집힌다.
  자체 타입을 정의하고 **도메인 쪽이 옮긴다** (`FetchErrorKind` → `failure_kind` 변환은
  `collect.service.ts`에 있다). 매핑을 `Record<A, B>`로 두면 한쪽이 늘 때 컴파일이 깨진다
- **NestJS 내장과 이름이 겹치지 않게 한다.** `HttpModule`은 `@nestjs/axios`가 쓴다

### 의존 방향

```
batch/<잡>/  →  modules/<도메인>/  →  modules/_common/  →  config/
```

- **도메인끼리 호출한다.** 막지 않는다 — NestJS 모듈 시스템(`imports`/`exports`)이
  그걸 위해 있고, 수집이 소스를 읽고 mention을 저장하는 건 이 제품의 본체 동작이다.
  provider를 쓰려면 **쓰는 쪽 모듈이 상대 모듈을 `imports`한다.** 전역 모듈을 만들지 않는다
- **순환은 피한다.** `forwardRef`로 뚫어야 하는 상황이면 경계가 잘못 그어진 것이다.
  지금 `mentions` → `collectors`(`CollectedMention`) 한 곳이 역방향이다 —
  `import type`이라 런타임 순환은 없지만 **저장 층이 수집 층을 알 이유는 없다.**
  건드릴 일이 생기면 저장 층이 자기 입력 형태를 갖는 쪽으로 정리한다
- `modules/`는 `batch/`를 모른다. 수집 잡이 도메인을 쓰는 방향만 있다
- **어댑터는 도메인이다.** `modules/collectors/`에 산다 — `batch/`가 아니다.
  경계는 **"무엇을 긁는가"(도메인) vs "언제·어떻게 돌리는가"(잡)**다.
  `pg_advisory_lock` · `collection_run` 기록 · 주기 게이트 · 소스 단위 실패 격리는
  전부 잡 쪽이고, 어댑터는 그걸 모른다. 수집이 이 제품의 본체이므로 `batch/`에 두면
  레이어가 뒤집힌다 — 1회성 임포트 잡과 다르다
- **`_common/`은 특정 도메인을 모른다**

### import 경로

- **디렉토리를 넘어가면 `@/`를 쓴다.** `../../`로 올라가지 않는다
- **같은 디렉토리는 `./`를 쓴다.** `@/`로 우회하지 않는다
- 별칭은 `tsconfig.json`의 `"@/*": ["src/*"]` 하나뿐이다. 늘리지 않는다

`tsc`는 출력 JS의 import 문자열을 다시 쓰지 않는다. 그래서 진입점마다 해석기가 따로 붙어 있다 —
`build`는 `tsc-alias`, `cli`·`migration:*`은 `-r tsconfig-paths/register`, `test`는 jest `moduleNameMapper`.
**새 진입점을 추가하면 그 진입점에도 해석기를 붙인다.** 안 붙이면 런타임에만 깨진다

## 3. 스키마는 migration만이 바꾼다

`synchronize: false`가 고정이다. `migrationsRun: false`도 고정 — **부팅이 스키마를 건드리지 않는다.**

```
엔티티 수정  →  npm run migration:generate  →  생성된 SQL을 읽는다  →  run
```

**생성된 migration을 읽지 않고 커밋하지 않는다.** 생성기가 문서와 다르게 내는 자리가 있다.

| 자리 | 지켜야 하는 것 |
| --- | --- |
| PK | `bigint GENERATED ALWAYS AS IDENTITY`. `bigserial`이 아니다 |
| PK 필드 타입 | **`string`이다.** pg 드라이버가 bigint를 문자열로 준다. `number`로 선언하면 거짓말이 된다 |
| 시각 | 전부 `timestamptz`. `@CreateDateColumn()`에도 `{ type: 'timestamptz' }`를 명시한다 |
| 열거값 | `text` + `CHECK`. **CHECK 식은 상수 배열에서 만든다** (`modules/_common/enum-check.ts`) — 배열과 DDL이 어긋날 수 없게 |
| 부분 인덱스 | `@Index(..., { where: ... })`. 조건을 빼면 테스트는 다 통과하고 틀린다 |

**변경 후 확인 3개** (`npm run migration:run`만으로는 SQL이 유효하다는 것밖에 안 나온다)

1. `migration:generate` 재실행 → `No changes` 여야 한다. 엔티티↔DB drift 없음
2. `docker exec chiikawa-postgres psql -U chiikawa -d chiikawa -c '\d+ <테이블>'` → `docs/db-schema.md`와 대조
3. `migration:revert` → `run` 왕복. **롤백 안 되는 migration은 결함이다**

## 4. 외부에서 온 값은 경계에서 파싱한다

`source.config`는 **DB 행에 든 임의 JSON**이다. 타입 단정으로 받지 않는다.

- **zod로 파싱한다.** 스키마가 유일한 타입 출처다 (`z.infer`)
- **로드 시점에 터진다.** `config`가 DB 행이니 "부팅 시점"이란 레지스트리가 행을 읽는 순간이다.
  어댑터 안에서 늦게 파싱하면 요건을 위반하면서 맞는 것처럼 보인다
- **부분 로드를 하지 않는다.** 소스 하나가 깨지면 던진다
- 정규식 필드는 **컴파일 가능한지까지** 본다. 못 쓰는 정규식을 수집 중에 발견하지 않는다

같은 원칙이 HTTP 응답에도 적용된다 — 상태 코드를 신뢰하지 않고 본문을 검증한다.
규범과 함정은 `collector-adapter-dev.md`.

## 5. 공식문서

**API 형태를 기억으로 쓰지 않는다.** 확인 순서는 이렇다.

**1순위 — 설치된 `.d.ts`.** `be/node_modules/`가 지금 돌아가는 버전의 진실이다.
문서와 어긋날 때도 이게 맞다.

```bash
grep -rn "찾는것" be/node_modules/typeorm/decorator/options/*.d.ts
cat be/node_modules/typeorm/decorator/columns/PrimaryGeneratedColumn.d.ts
```

`fe/`가 `node_modules/next/dist/docs/`를 1순위로 보는 것과 같은 이유다 —
**설치된 버전에 고정돼 있고, grep이 되고, 오프라인이다.** `be/`의 패키지들은 문서 트리를 번들하지
않으므로 그 자리를 `.d.ts`가 맡는다. 오버로드·옵션 이름·유니온 값을 여기서 확인한다.

**2순위 — context7 MCP.** `resolve-library-id` → `query-docs`. 학습 데이터보다 새 문서가 나온다.
**3순위 — 각 에이전트의 「공식문서」 절 URL.** 위 둘로 안 되면 본다.

**확인한 근거를 남긴다** — 커밋 메시지나 코드 주석에. 다음 사람이 같은 grep을 반복하지 않게.

**버전 숫자는 `be/package.json`이 진실이다.** 이 문서에 적지 않는다.
왜 최신이 아닌지는 `docs/tech-stack.md` §1.4, TypeORM 1의 함정은 §1.5.

## 6. 하지 않는 것

- **`main.ts`에서 HTTP 서버를 띄우지 않는다** (§1)
- **엔티티를 `database/entities/`류 레이어 디렉토리에 모으지 않는다** (§2)
- **`synchronize: true`를 쓰지 않는다.** 로컬에서도 안 쓴다 — migration이 검증되지 않는다
- **`getRepository()` 같은 전역 함수를 쓰지 않는다.** TypeORM 1에 없다. DI로 받는다
- **`where`에 `null`/`undefined`가 흘러가게 두지 않는다.** TypeORM 1은 던진다.
  0.3은 조용히 전체 행을 돌려줬다 — 그 예제를 붙이면 여기서 깨진다
- **하드 삭제를 하지 않는다.** `suppressed_at` / `source.enabled=false`.
  `mention`은 UPDATE도 하지 않는다 — 불변이다
- **파싱 규칙(정규식·날짜 형식·필터 조건)을 코드에 하드코딩하지 않는다.** `source.config`에서 읽는다
- **판정 못 한 값을 채우지 않는다.** 비운다. `9月下旬`을 날짜로 만들지 않는다
- **진단 커맨드에 우회 플래그를 만들지 않는다.** `cli health`는 깨진 `config` 행이 있으면 죽는다.
  §4대로 동작하는 것이고, 그 비용을 받는다 — 깨진 행은 `psql`로 본다

## 7. 미결정

현재 없음.
