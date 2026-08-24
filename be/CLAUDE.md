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
│   └── <도메인>/
│       ├── entities/*.entity.ts
│       ├── *.service.ts
│       └── <도메인>.module.ts
└── batch/<잡>/             nest-commander 배치 잡. 어댑터가 여기 산다
```

- **엔티티는 도메인 모듈 안에 둔다.** `database/entities/` 같은 **레이어 분할을 하지 않는다**
- 디렉토리명은 **복수**, 테이블명은 **단수** (`modules/sources/` ↔ `source`)
- **빈 `.module.ts`를 미리 만들지 않는다.** provider가 생길 때 만든다.
  엔티티만 있는 도메인은 `entities/`만 있으면 된다
- `TypeOrmModule.forFeature`는 **쓰는 모듈이** 등록한다. 전역 레포 모듈을 만들지 않는다

### 의존 방향

```
batch/<잡>/  →  modules/<도메인>/  →  modules/_common/  →  config/
```

- **도메인끼리 서로 import하지 않는다.** 엔티티 참조(FK)는 예외 — 상대경로로 직접 가리킨다
- `modules/`는 `batch/`를 모른다. 수집 잡이 도메인을 쓰는 방향만 있다
- **`_common/`은 특정 도메인을 모른다**

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

| 항목 | 선택지 |
| --- | --- |
| `@/` 경로 별칭 | `tsconfig.json`에 `"@/*": ["src/*"]`가 있지만 **사용처가 0개**다. `tsc`는 출력 JS의 import 문자열을 다시 쓰지 않으므로, `@/`를 쓰기 시작하면 `npm start`(`node dist/main`)가 깨진다. ① 안 쓴다 — `paths`와 `tsconfig-paths`를 지운다 ② 쓴다 — `start`에 `-r tsconfig-paths/register`를 붙이거나 빌드 후 `tsc-alias`를 돌린다. **정하기 전까지 상대경로만 쓴다** |
