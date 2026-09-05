# ちいかわ 굿즈 알리미 — 기술 선정서

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | **초안 (draft)** |
| 버전 | v0.1 |
| 상위 문서 | [[plan]] (제품 기획) |
| 관련 문서 | [[data-collection-design]] (수집·데이터 설계) |
| 범위 | 기술 선정과 그 근거. **구현 코드 미포함** |

---

## 0. 선정 기준

우선순위 순서다. 아래로 갈수록 약한 기준이다.

1. **`tomomachi` 스택을 재사용한다.** 1인 개발이다. 새 기술을 배우는 시간은 어댑터를 늘리는 시간에서 빠진다.
2. **무수익 전제([[plan]] §2.3)에서 고정비를 최소화한다.** 유휴 시 과금되는 리소스를 늘리지 않는다.
3. **운영 규범([[plan]] §2.2)을 기술로 강제할 수 있어야 한다.** 중복 실행·동시 요청 폭주가 구조적으로 불가능해야 한다.
4. **이전 가능성을 유지한다.** 무료 크레딧 소진 후 다른 곳으로 옮길 수 있어야 한다.

---

## 1. 확정 스택

### 1.1 애플리케이션

> **버전 숫자는 `be/package.json`·`fe/package.json`이 진실이다.** 아래 표는 **선정 근거**만 남긴다.
> 2026-08-23 실측(npm registry)으로 결정했고, 갱신 시 §1.4의 상한 근거를 함께 확인한다.

| 층 | 선정 | 근거 |
| --- | --- | --- |
| 언어 | TypeScript 5 | **5에 머문다. 상한 근거는 §1.4** — 최신은 7이지만 도구가 못 받는다 |
| 런타임 | Node.js | Active LTS(24) 목표. `engines`는 `^22.13 \|\| >=24.11` — TypeORM 1.x가 요구하는 범위 |
| 프레임워크 | NestJS 11 | `tomomachi` 동일 |
| 배치 진입점 | `nest-commander` | 어댑터 1개 = provider 1개. `tomomachi`의 `src/batch/` 패턴 |
| HTTP 진입점 | `@nestjs/platform-express` | 읽기 API 전용. **같은 코드베이스의 다른 진입점** → §2.8 |
| ORM | **TypeORM 1** | `tomomachi`는 0.3이지만 신규 프로젝트다 → §1.5 |
| DB 드라이버 | `pg` | 표준 Postgres |
| snake_case | `typeorm-naming-strategy` | `tomomachi`의 `typeorm-naming-strategies`(복수형)는 TypeORM 1을 못 받는다 → §1.5 |
| 검증 | `class-validator` + `class-transformer` | `tomomachi` 동일 |
| `robots.txt` 해석 | `robots-parser` | **직접 짜지 않는다.** 경로 매칭을 틀리면 금지 경로를 때리고 소스를 영구히 잃는다 → §5 |
| XML 파싱 | `fast-xml-parser` | sitemap 인덱스. 정규식으로 `<loc>`을 긁으면 소프트 404 HTML도 통과한다 ([[data-collection-design]] §7) |
| 로깅 | `winston` + `nest-winston` | **`winston-daily-rotate-file` 제외** (§1.6) |
| 테스트 | Jest + `ts-jest` | `tomomachi` 동일 |
| 린트 | ESLint 9 + Prettier + `simple-import-sort` | **9에 머문다. 상한 근거는 §1.4** |

### 1.2 프론트엔드 (v0부터)

| 층 | 선정 | 근거 |
| --- | --- | --- |
| 프레임워크 | Next.js 16 (App Router) + React 19 | `tomomachi-fe` 동일. **16에서 Turbopack이 기본, `next lint` 제거** |
| 스타일 | Tailwind CSS 4 + `clsx` + `tailwind-merge` | `tomomachi-fe` 동일 |
| 서버 상태 | TanStack Query 5 | `tomomachi-fe` 동일 |
| 스키마 | zod 4 | `tomomachi-fe` 동일 |
| 빌드 | `output: 'standalone'` + Dockerfile | Cloud Run 배포. `tomomachi-fe` 동일 |
| **제외** | `zustand` | 서버 상태만 다룬다. 클라이언트 전역 상태 없음 |
| **제외** | Firebase Auth | 로그인이 없다 ([[plan]] §1.4). v1 웹 푸시 구독도 익명 |

> **v0부터 공개 화면이 있다.** 읽기 전용 3섹션 ([[plan]] §6.2).
> 도메인·약관·삭제요청 창구가 v0 착수 조건이 된다 ([[plan]] §8.1).

### 1.3 인프라

| 층 | 선정 | 근거 |
| --- | --- | --- |
| 클라우드 | **GCP (신규 프로젝트)** | `tomomachi`와 과금·장애 격리 |
| IaC | Terraform | `tomomachi-infra` 모듈 재사용 |
| 컨테이너 레지스트리 | Artifact Registry | 동일 |
| 배치 실행 | **Cloud Run Job** | 수집기. 외부 호출 표면 없음. 유휴 과금 0 |
| 웹 | **Cloud Run Service** (공개) + 커스텀 도메인 매핑 | Next.js. v0부터 |
| 읽기 API | **Cloud Run Service** (비공개) | NestJS HTTP. `fe/`의 서버 컴포넌트만 호출한다 → §2.8 |
| 스케줄 | **Cloud Scheduler** (`time_zone: Asia/Tokyo`) | 타임존 직접 지정 |
| DB | **Cloud SQL for PostgreSQL 18** `db-f1-micro` | RDB 1개 통합 보관. 18은 Cloud SQL 기본값이고 로컬 `postgres:18-alpine`과 메이저가 같다 |
| DB 접속 | `/cloudsql` **Unix 소켓 볼륨 마운트** | `tomomachi`의 Job과 동일 방식 |
| 시크릿 | Secret Manager (**껍데기만 IaC, 값은 수동**) | `tomomachi` 규약 |
| CI/CD | GitHub Actions + Workload Identity Federation | 서비스 계정 키 파일 미사용. **검사 워크플로는 `.github/workflows/ci.yml`** — PR마다 lint·typecheck·test·build, migration은 Postgres 서비스 컨테이너에서 drift·revert 왕복까지 (`be/CLAUDE.md` §3). 배포 워크플로는 infra 착수 시 |
| 리전 | `asia-northeast1` (도쿄) | 대상 사이트가 전부 일본 |

### 1.4 버전 상한은 왜 최신이 아닌가

최신 버전을 못 쓴 곳만 적는다. **상한이 풀리는 조건**을 같이 적어야 다음에 다시 조사하지 않는다.

| 항목 | 최신 | 채택 | 막은 것 | 풀리는 조건 |
| --- | --- | --- | --- | --- |
| TypeScript | 7 | 5 | `ts-jest` peer `typescript: >=4.3 <7`<br>`typescript-eslint` peer `typescript: >=4.8.4 <6.1.0` | 둘 다 상한을 올릴 때 |
| ESLint | 10 | 9 | `eslint-config-next`가 끌어오는 `eslint-plugin-react`가 ESLint 10에서 죽는다 — `context.getFilename is not a function` (실측 확인) | `eslint-config-next`의 `eslint-plugin-react`가 ESLint 10 대응 |
| `@types/node` | 26 | 24 | 없음 — 런타임(Node 24)에 맞춘다 | Node를 26으로 올릴 때 |

**ESLint는 `be/`와 `fe/`를 같은 메이저로 맞춘다.** `be/`만 10으로 올릴 수는 있지만,
두 디렉토리의 린트 규약이 갈리는 비용이 메이저 1개의 이득보다 크다.

**TypeScript 7은 네이티브 포트다.** 상한이 풀리면 `emitDecoratorMetadata`(NestJS DI·TypeORM 컬럼 추론·
`class-validator`가 전부 여기 얹혀 있다)가 그대로 나오는지 **컴파일 결과로** 확인한 뒤 올린다. 문서 문장으로 판단하지 않는다.

### 1.5 TypeORM은 0.3이 아니라 1이다

`tomomachi`는 0.3이고 0.3 브랜치도 계속 유지보수된다(1.1.0과 0.3.31이 같은 날 나왔다).
그런데도 1을 고른 이유는 **이 프로젝트에 이전할 데이터가 없다**는 것이다.
0.3 → 1의 breaking change는 거의 전부 "기존 코드가 깨진다"는 성격이고, 우리는 기존 코드가 없다.

가져오는 것:

- `where`에 `null`/`undefined`가 들어오면 **던진다.** 0.3은 조용히 전체 행을 반환했다.
  「없는 정보를 만들지 않는다」를 ORM이 강제해 준다
- 전역 함수(`createConnection`·`getRepository`)와 `@EntityRepository` 제거 → DI 경로가 하나로 남는다
- Node 20+ / ES2023 기준

대가 3개:

1. **`typeorm-naming-strategies`(복수형)를 못 쓴다.** peer가 `^0.2 || ^0.3`이고 2022년 이후 갱신이 없다.
   `typeorm-naming-strategy`(단수형, peer `^0.3 || ^1.1`)로 바꿨다. 이것도 개인 관리 패키지이므로,
   막히면 `SnakeNamingStrategy`를 직접 들고 온다 — `DefaultNamingStrategy` 상속 메서드 8개짜리다
2. **드라이버별 옵션 타입의 deep import가 사라졌다.** `typeorm/driver/postgres/PostgresConnectionOptions`는
   더 이상 없다. `Extract<DataSourceOptions, { type: 'postgres' }>`로 좁힌다
3. **`.env` 자동 로드와 `TYPEORM_*` 환경변수가 제거됐다.** 마이그레이션 CLI는 Nest 컨텍스트 밖에서 도니
   `data-source.ts`가 직접 `dotenv`를 읽는다

### 1.6 재사용 가능 여부 정리

`tomomachi-infra`에서 그대로 가져오는 것과 새로 짜야 하는 것.

| 모듈 | 상태 |
| --- | --- |
| `apis` / `artifact-registry` / `iam` / `workload-identity` / `secret-manager` | ✅ 재사용 |
| `cloud-sql` | ✅ 재사용 (`db-f1-micro`, `PD_SSD`, `disk_autoresize` — §4.2 주의) |
| `cloud-run` | ⚠️ 부분 재사용. `google_cloud_run_v2_job` 선례 있음 (`area-import-job`) |
| **`cloud-scheduler`** | ❌ **없음. 신규 작성** |
| `cloud-storage` | 미사용 (이미지 호스팅 안 함) |

애플리케이션 쪽에서 안 가져오는 것: Firebase Admin, Google Maps / Vision, `adm-zip`, `csv-parse`, `@nestjs/swagger`(§5), `winston-daily-rotate-file`.

---

## 2. 선정 근거

### 2.1 클라우드는 GCP

`tomomachi`의 NestJS + TypeORM + Terraform 자산이 그대로 살아난다. 1인 개발에서 이 이득이 가장 크다.

Cloudflare Workers는 런타임이 달라 NestJS를 올릴 수 없다 — 스택을 새로 짜야 한다.
Workers를 고려할 유일한 이유였던 "분 단위 cron"은 Cloud Scheduler가 타임존까지 포함해 해결한다.

**대가**: D1(무료) 대신 Cloud SQL(유료). 크레딧 만료 후 고정비가 남는다 → §2.6

---

### 2.2 스케줄은 Cloud Scheduler → Cloud Run Job

**선택지 3개**

| | 방식 | 유휴 비용 | 스케줄 정의 |
| --- | --- | --- | --- |
| A | **Scheduler → Cloud Run Job** ← 채택 | 0 | Terraform |
| B | Scheduler → Cloud Run Service HTTP 엔드포인트 | 0 | Terraform |
| C | Cloud Run Service 상주 + `@nestjs/schedule` | **상시 과금** | 코드 |

**C를 쓰지 않는 이유 — 비용이 아니라 중복 실행이다**

`@nestjs/schedule`은 `setInterval` 계열이라 조건 2개가 필요하다.

1. 프로세스 상주 — Cloud Run은 요청이 없으면 인스턴스를 0으로 내린다. 인스턴스가 죽으면 타이머도 죽는다
2. CPU 상시 할당 — 기본값은 요청 처리 중에만 CPU를 준다. 유휴 중 throttle되면 타이머가 제때 깨지 않는다

둘을 켜면 `min-instances ≥ 1` + CPU 상시 할당 = **상시 과금**이고, scale-to-zero 이점을 버린다.
게다가 인스턴스가 2개로 늘면 **cron이 2번 발화한다.** 수집기가 2번 돌면 대상 서버에 2배 부하가 간다 —
**운영 규범([[plan]] §2.2)을 직접 깬다.** 막으려면 분산 락이나 `max-instances=1` 고정이 필요하다.

C의 장점은 "스케줄 추가가 코드 변경만으로 끝난다"이지만, 락으로 규범 위반을 막는 비용이 그 이점을 넘는다.

**B가 아니라 A인 이유**

B는 IAM이 단순하지만(OIDC 토큰 + `run.invoker`) **수집기를 기동하는 표면을 공개 인터넷에 둔다.**
인증이 새는 순간 아무나 수집기를 돌릴 수 있고, 그건 다시 규범 위반이다.
Job은 애초에 외부에서 호출할 표면이 없다.

v0부터 공개 웹이 있지만 그건 **읽기 전용 별도 Cloud Run Service**다 (§2.8). 수집기 Job과 배포·권한이 분리된다.

**A의 대가**: Cloud Run Admin API `:run` 호출 경로 + 서비스 계정 IAM을 짜야 한다. `tomomachi`에 선례가 없다.

**부수 규칙**: `@nestjs/schedule`은 **로컬 개발 편의용으로만** 허용한다. 프로덕션 스케줄은 전부 Terraform에 있다.

---

### 2.3 수집기 진입점은 `nest-commander` CLI

Cloud Run Job은 컨테이너를 실행하고 끝난다. 진입점이 CLI 커맨드면 그대로 매핑된다.

- 어댑터 1개 = NestJS provider 1개. 어댑터 계약([[data-collection-design]] §4)이 DI로 그대로 표현됨
- 소스 단위 실패 격리를 커맨드 인자로 구현 — 특정 어댑터만 실행 가능
- `tomomachi`의 `src/batch/` 패턴과 동일하므로 판단할 게 없다
- 로컬에서 한 줄로 재현 가능. 수집기 디버깅이 배포와 무관해진다

---

### 2.4 PostgreSQL + TypeORM, migration-driven

RDB 1개에 전부 보관한다. `mention` · `item` · `drop` · `status_history` · `merge_override`가
전부 조인 대상이고, 중복 제거([[data-collection-design]] §9)가 SQL로 표현된다.

**규약** (`tomomachi` 계승)

- `synchronize: false`. entity를 직접 고쳐서 반영하지 않는다
- 스키마 변경은 항상 migration. 생성된 SQL을 눈으로 확인하고 적용
- naming strategy는 `typeorm-naming-strategies` (snake_case)

**Cloud SQL 고유 기능은 쓰지 않는다.** 표준 Postgres 범위 내로 유지 → §2.6

---

### 2.5 public 단일 저장소

```
chiikawa-goods/
├── docs/    설계 문서
├── be/      NestJS 수집기
├── fe/      Next.js
└── infra/   Terraform
```

`tomomachi`는 repo를 4개로 분할하지만 개인 규모에서는 오버헤드다. 필요해지면 그때 분리한다.
public으로 두는 이유는 **운영 규범이 요구하는 연락처 URL**이다 — 저장소가 창구를 겸한다.

> [!warning] public이므로 커밋 규칙이 `tomomachi`와 다르다
> **공개를 허용하는 것**: GCP 프로젝트 ID, 서비스 계정 이메일, Cloud SQL 인스턴스명, 리소스 구성.
> 자격 증명이 아니다.
>
> **절대 커밋하지 않는 것**: `terraform.tfvars`, Terraform state, 서비스 계정 키,
> DB 비밀번호, Discord Webhook URL, 대상 사이트 인증 정보.
>
> Secret Manager는 **껍데기만 Terraform으로 만들고 값은 수동 투입**한다 (`tomomachi` 규약).
> `.gitignore`를 첫 커밋에 포함한다.

---

### 2.6 이전 가능성은 설계 요건이다

GCP 무료 크레딧은 **$300 / 90일**. Cloud Run은 scale-to-zero라 거의 0이고,
**비용은 사실상 Cloud SQL 전부다** (상시 과금 + 스토리지 + IP).

크레딧 만료 시 선택지는 (a) 자기 부담 (b) 무료 티어 외부 Postgres 이전 (c) 종료.
**(b)를 열어 두는 것이 설계 요건이다.** 요건 2개:

**1. 접속 방식을 환경변수로 추상화한다**

Cloud SQL은 `/cloudsql` **Unix 소켓 마운트**, 외부 Postgres는 **TCP + TLS**다.
접속 문자열 교체만으로 끝나지 않는다. TypeORM 설정이 처음부터 양쪽을 받도록 짠다.

**2. 데이터가 무료 티어 용량에 들어가는 크기로 유지된다** → §2.7

**일정**: 크레딧 만료일을 캘린더에 등록. **만료 30일 전 재판단.**

---

### 2.7 `raw_payload` 보존 상한을 첫 커밋에 넣는다

보존 상한이 없으면 §2.6의 출구가 막힌다.

- 크레딧 3개월을 무제한 보존으로 돌리면 재판단 시점에 데이터가 무료 티어에 안 들어간다
- `tomomachi`의 cloud-sql 모듈은 `PD_SSD` + `disk_autoresize = true`다.
  **한 번 늘어난 디스크는 축소되지 않고** 그만큼 계속 과금된다

**규칙**

| 대상 | 보존 |
| --- | --- |
| `mention` 행 (제목·URL·날짜·메타) | **영구** — 감사 추적 |
| `mention.raw_payload` | **90일 후 삭제** (잠정) |
| 저장 조건 | **내용 해시 비교. 무변경이면 저장하지 않음** |

1시간 폴링은 대부분 무변경이므로 해시 비교만으로 대부분 줄어든다.
90일은 운용 1개월 후 실측 증가율로 조정한다.

### 2.8 화면은 DB를 직접 읽지 않는다. 읽기 API를 거친다

Next.js 서버 컴포넌트가 Postgres를 직접 읽는 게 표준 패턴이고 서비스도 하나 덜 든다.
그래도 API를 거치는 쪽을 골랐다. 이유 2개.

**1. 공개 서비스에 DB 자격증명을 두지 않는다.** 직접 읽기는 인터넷에 노출된 웹 서비스에
`/cloudsql` 마운트와 DB 비밀번호를 준다. 웹은 공격 표면이 가장 넓은 층이다.
API를 끼우면 자격증명이 **비공개 서비스에만** 남는다.

**2. `fe/`가 스키마에 직접 묶이지 않는다.** `mention`·`status_history`·`scheduled_event`의
3층 구조([[data-collection-design]] §3)는 화면이 알 필요가 없다. 화면이 필요한 건 「뱃지와 날짜」다.
직접 읽으면 뷰 이름 변경이 화면을 깨고, 이 프로젝트는 스키마가 아직 움직인다.

대가: Cloud Run Service가 1개 늘고, `be/`에 HTTP 진입점이 생긴다.

**Job의 무표면 원칙(§2.2)은 유지된다.** 수집기 Job과 읽기 API는 **같은 코드베이스의 다른 진입점**이다.
수집기를 기동할 수 있는 표면은 여전히 인터넷에 없다.

**읽기 전용이다.** v0에 쓰기 엔드포인트를 만들지 않는다. 수동 교정([[plan]] §7)은 DB 직접 조작이다.

미결정 — 착수 시 정한다:

| 항목 | 선택지 |
| --- | --- |
| API 서비스의 인증 | Cloud Run 서비스 간 ID 토큰(`run.invoker`) / 공개 + 읽기 전용 |
| 응답 형태 | 화면 단위 조립(홈 3섹션을 한 번에) / 리소스 단위 |
| 페이지네이션 | 아카이브에만 필요하다. 커서 / 오프셋 |

---

## 3. 로컬 개발 환경

| 항목 | 방식 |
| --- | --- |
| Node | volta 핀은 24.19.0. `engines`가 22.13+도 받으므로 22 LTS에서도 돌아간다 |
| DB | `be/`에서 `npm run db:up` (`docker compose`). **호스트 포트 5433** — 다른 프로젝트의 5432와 안 부딪히게 |
| 마이그레이션 | `migration:generate` / `run` / `revert` / `show` |
| 수집기 실행 | `nest-commander` 커맨드 직접 호출. 어댑터 단위 실행 |
| 스케줄 | 로컬에 한해 `@nestjs/schedule` 허용. 프로덕션 반영 금지 |
| 훅 | lefthook (`tomomachi-fe` 동일). **아직 안 넣음** |
| 부팅 확인 | `be/`에서 `npm run cli health` — DB 버전과 미적용 마이그레이션 유무만 찍는다. 외부 요청 없음 |

**`postgres:18` 이미지는 볼륨 마운트 위치가 바뀌었다.** `/var/lib/postgresql/data`에 걸면
`unused mount/volume`으로 기동을 거부한다. 18+는 데이터를 메이저버전별 하위 디렉토리에 두므로
마운트는 `/var/lib/postgresql` 한 곳이다 (`pg_upgrade --link`를 마운트 경계 없이 쓰기 위한 변경).

**`cli health`는 `source.config`가 깨진 소스가 있으면 죽는다.** 레지스트리가 로드 시점에
검증하기 때문이고 의도된 동작이다 — 진단 커맨드가 정작 DB가 깨졌을 때 못 쓰인다는 비용을 받아들인다.
우회 플래그를 만들지 않는다. 깨진 행은 `psql`로 본다.

**로컬 실행 시에도 운영 규범을 지킨다.** 개발 중이라고 폴링 간격을 줄이지 않는다.
대상 서버 입장에서 개발용 요청과 프로덕션 요청은 구별되지 않는다.
가능하면 저장된 `raw_payload` 픽스처로 파서를 개발한다 ([[data-collection-design]] §10.2와 동일 자산).

**공식문서 URL은 각 에이전트 프롬프트(`.claude/agents/*.md`)의 「공식문서」 절에 있다.**
여기에 복사하지 않는다 — 두 곳에 두면 어긋난다.

---

## 4. 착수 전 검증 항목

코드를 쓰기 전에 확인한다. 실패하면 선정이 흔들린다.

| # | 항목 | 실패 시 |
| --- | --- | --- |
| 1 | **분 범위 cron 수용** — `50-59 10 * * *` + `time_zone: Asia/Tokyo` | 스케줄 설계 재판단 ([[data-collection-design]] §6) |
| 2 | **`:run` 호출 최소 권한** — `roles/run.invoker`로 되는지, `roles/run.developer`가 필요한지 | 후자면 권한이 과하다. 커스텀 역할 검토 |
| 2b | Scheduler가 `oauth_token`으로 Admin API에 붙는지 (OIDC 아님) | §2.2의 B안으로 변경 |
| 2c | Scheduler job 개수와 무료 한도 (현재 설계 4개) | 초과 시 job당 소액 과금 |
| 3 | Cloud Run Job에서 `/cloudsql` 소켓 마운트로 Postgres 접속 | `tomomachi` 선례 있으므로 낮은 리스크 |
| 4 | `db-f1-micro`가 1시간 폴링 부하를 감당하는지 | 사양 상향 = 고정비 증가 |

### 4.1 중복 실행은 스케줄러를 바꿔도 남는다

`@nestjs/schedule`을 버린 이유가 중복 발화였지만(§2.2), **Cloud Run Job도 execution이 겹친다.**
1분 간격에서 수집이 70초 걸리면 2개가 동시에 돈다.

→ **Postgres advisory lock으로 소스 단위 직렬화**한다.
추가 인프라는 없다 (DB가 이미 있다). 상세: [[data-collection-design]] §6.2.

**즉 §2.2의 결정은 "중복이 안 난다"가 아니라 "상시 과금 없이 중복을 막을 수 있다"였다.**

### 4.2 `disk_autoresize` 주의

`tomomachi`의 cloud-sql 모듈은 `disk_autoresize = true`다.
**축소되지 않는다.** §2.7의 보존 규칙을 v0 첫 커밋에 넣지 않으면 크레딧 기간 중 불어난 용량이 그대로 고정비가 된다.

---

## 5. 버리는 선택지 요약

| 후보 | 버린 이유 |
| --- | --- |
| Cloudflare Workers + D1 | NestJS를 못 올린다. 스택 재사용 이득 상실 (§2.1) |
| `@nestjs/schedule` (프로덕션) | scale-to-zero와 양립 불가 + 중복 발화가 운영 규범 위반 (§2.2) |
| Scheduler → HTTP 엔드포인트 | 수집기 기동 표면을 공개 인터넷에 두게 됨 (§2.2) |
| Firebase Auth | v0/v0.5에 로그인 없음 |
| `zustand` | 서버 상태만 다룬다 |
| Cloud Storage 이미지 캐싱 | 저작물. 파일을 갖지 않고 원본 CDN 참조로 낸다 ([[plan]] §2.1) |
| `@nestjs/swagger` | 읽기 API의 소비자가 `fe/` 하나뿐이다. 스키마는 zod로 `fe/` 경계에서 검증한다 (§2.8) |
| repo 분할 | 개인 규모에 오버헤드 (§2.5) |
| `robots.txt` 매처 자체 구현 | 와일드카드·`$`·최장일치 규칙이 미묘하다. 틀린 허용은 되돌릴 수 없다 (§1.1) |
| `crawlee` | **요청 큐·결과를 로컬 파일에 쓴다**(`./storage`). Cloud Run Job은 컨테이너가 매번 죽어 그 상태가 남지 않고, 우리는 이미 DB가 그 역할을 한다(`collection_run`·`pg_advisory_lock`·`mention`) → **상태 저장소가 둘이 된다.** 본체 기능인 브라우저 크롤링도 우리가 안 쓴다(CSR 우회 금지) |
| `nest-crawler` | **2022-05 이후 방치**(v1.9.0). NestJS 11을 받지 못한다 |
| `p-queue` | ESM 전용. 현재 빌드가 CommonJS다 |
| `@nestjs/throttler` | **들어오는** 요청을 제한한다. 우리가 필요한 건 **나가는** 쪽이다 |
| `axios` / `got` | Node 24 내장 `fetch`로 충분하다. 재시도·간격은 어차피 우리가 감싼다 |

---

## 관련 문서

- [[plan]] — 제품 기획 (왜)
- [[data-collection-design]] — 수집·데이터 설계 (어떻게)
- [[치이카와 굿즈 알리미 소스 조사]] — 소스 실지조사 결과
