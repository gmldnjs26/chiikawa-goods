# CLAUDE.md

ちいかわ 굿즈 정보를 한 곳에 모아 타임라인과 알림으로 제공하는 개인 프로젝트.

## 설계 문서를 먼저 읽는다

작업 전에 해당 문서를 읽는다. 여기 없는 내용을 추측으로 만들지 않는다.

| 문서 | 내용 | 언제 읽나 |
| --- | --- | --- |
| `docs/plan-draft.md` | 제품 기획 · 비목표 · 마일스톤 | 기능 판단이 필요할 때 |
| `docs/data-collection-design.md` | 데이터 3층 · 어댑터 계약 · 스케줄 | 수집 관련 전부 |
| `docs/db-schema.md` | 테이블 · 제약 · 인덱스 | 엔티티 · migration |
| `docs/source-mapping.md` | 소스 원문 → 컬럼 매핑 · 태그 인벤토리 | 파서 구현 |
| `docs/tech-stack.md` | 기술 선정 근거 · 검증 항목 | 라이브러리 · 인프라 |

**문서와 코드가 어긋나면 문서를 고친 뒤 코드를 고친다.** 반대로 하지 않는다.

## 개발 순서

```
1. be/    NestJS 수집기 + PostgreSQL (로컬 docker)
2. fe/    Next.js 화면
3. infra/ GCP + Terraform   ← 1, 2가 끝난 뒤에 착수
```

**GCP는 마지막이다.** 로컬에서 `docker compose`로 Postgres를 띄우고 개발한다.
클라우드 비용·크레딧을 개발 기간에 태우지 않는다.

## 절대 규칙

### 1. 크롤러 행동 규범 — 어기면 소스를 영구히 잃는다

- User-Agent는 `chiikawa-goods-bot/0.1 (+https://github.com/gmldnjs26/chiikawa-goods)`
- `robots.txt` 준수. `Crawl-delay` 존중. **동시 요청 1**
- **원문 전재 금지.** 제목 · 가격 · 날짜 · 링크만 저장한다. 이미지는 링크 참조만
- 차단 신호(403 / 429 / 챌린지)를 받으면 그 소스를 **자동으로 정지**한다
- **우회 금지.** Cloudflare 챌린지, robots가 막은 API, CSR 전용 내부 API는 건드리지 않는다
- **로컬 개발도 동일하다.** 상대 서버는 개발 요청과 프로덕션 요청을 구별하지 않는다.
  파서는 저장된 `raw_payload` 픽스처로 개발한다

### 2. 무수익

광고 · 어필리에이트 · 유료화 코드를 넣지 않는다. 재류자격 문제다 (`plan-draft.md` §2.3).

### 3. 데이터 층을 섞지 않는다

```
mention   상대가 말한 것       불변. 절대 수정하지 않는다
item      우리가 정리한 것      가변
status_history   과거 전이     append-only
scheduled_event  미래 예정     append-only + superseded_at
```

- **상태는 `UPCOMING` / `ON_SALE` / `ENDED` 3개뿐이다.** 늘리지 않는다
- **`RESTOCK`은 상태가 아니다.** `ENDED → ON_SALE` 전이다. 반복된다
- 화면 뱃지 = **상태 + 가장 가까운 예정**
- `status_history`에 `(item_id, status)` unique를 걸지 않는다. 재입고↔품절이 반복된다
- 알림 중복 방지 키는 **`status_history.id`**. `(drop_id, trigger)`가 아니다

### 4. 없는 정보를 만들지 않는다

- `9月下旬`을 `9/21`로 정규화하지 않는다. `scheduled_text`에 원문 그대로 넣는다
- 브랜드를 판정 못 하면 `NULL`. 화면에는 `その他`로 **보여준다.** 숨기지 않는다
- 개시 시각은 추정값이다. UI에 「추정」을 명시한다
- 모순된 입력(`販売開始前` + `available=true`)은 조용히 한쪽으로 정하지 않는다. **경보**

### 5. 파싱 규칙은 코드에 두지 않는다

태그 정규식 · 날짜 형식 · 필터 조건은 전부 `source.config`(jsonb)다.
소스 추가 = `source` 행 1개 + migration 1개. **코드 변경 없음.**

같은 Shopify라도 태그 형식이 다르다 — `20260821` vs `2026年8月7日発売商品`.
재입고 태그는 8자리와 6자리가 공존한다. **규칙은 배열이다.**

### 6. 하드 삭제 금지

삭제 요청은 `suppressed_at` / `source.enabled=false`로 가린다. 행을 지우지 않는다.
`mention`은 파서 회귀 검증의 유일한 근거다.

### 7. 기능 추가 판별 질문

> **"이거 블로그도 할 수 있나?"** → 예스면 하지 않는다.

차별점은 2개뿐이다 — **타임라인 + 푸시**, **예약 사전 감지**.
검색 · 커뮤니티 · 가격 비교 · 이미지 호스팅은 비목표다.

## 기술 규약

| 항목 | 규약 |
| --- | --- |
| Node | 22.18.0 (volta 고정) |
| BE | NestJS 11 + `nest-commander` CLI. 어댑터 1개 = provider 1개 |
| ORM | TypeORM 0.3. **`synchronize: false`.** entity 직접 수정 금지, 항상 migration |
| 명명 | `typeorm-naming-strategies` snake_case. 테이블명 단수 |
| 예약어 | **`drop`은 SQL 예약어.** 테이블은 `drop_group`, 컬럼은 `drop_id` |
| 열거값 | `text` + `CHECK`. Postgres `enum` 타입 금지 (`ALTER TYPE` 부담) |
| 시각 | `timestamptz`. 발매일·예약일은 `date` (JST 달력일) |
| FE | Next.js 16 App Router + Tailwind 4 + TanStack Query + zod. **zustand 미사용** |
| 인증 | 없음. Firebase 미사용 |
| 스케줄 | 프로덕션은 Cloud Scheduler. **`@nestjs/schedule`은 로컬 전용** |
| 중복 실행 | `pg_advisory_lock(source_id)`. 못 잡으면 즉시 종료 |
| 로깅 | winston + `nest-winston`. `winston-daily-rotate-file` 미사용 |

## 화면 규약

- 홈은 **상태 우선** — 🟢 지금 살 수 있는 것 / 🔜 곧 / 🔵 재입고를 기다릴 수 있는 것
- 카드 필수 4요소 — 브랜드 칩 · 채널 · 지역 · 확정/랜덤
- **카드를 내는 최소 조건**: `channel` + 날짜 + `status`. 없으면 내지 않는다
- 캘린더에는 `item`이 아니라 **사건**을 놓는다. 같은 굿즈가 예약일·발매일에 두 번 나온다
- 필터는 채널 우선. 체크박스 `ランダム除く` / `オンラインだけ`가 실사용 1순위
- `region`(가야 하는가)과 `labels`(정보 칩)를 혼동하지 않는다.
  `川越店限定`은 온라인에서 살 수 있으므로 `labels`다
- 서비스 언어는 **일본어**. 설계 문서만 한국어

## 커밋

- 커밋 · 푸시는 **요청받았을 때만** 한다
- Conventional Commits. 메시지는 무엇을 왜 바꿨는지 쓴다
- **커밋 금지**: `terraform.tfvars`, tfstate, 서비스 계정 키, DB 비밀번호, Webhook URL
- 저장소는 **public**이다. 자격 증명이 아닌 리소스 이름은 공개해도 된다

## 에이전트

작업에 맞는 에이전트를 쓴다. `.claude/agents/` 참조.

| 에이전트 | 용도 |
| --- | --- |
| `collector-adapter-dev` | 수집 어댑터 · 파서 · 정규화 |
| `schema-migration-dev` | TypeORM 엔티티 · migration |
| `frontend-dev` | Next.js 화면 |
| `source-investigator` | 소스 실지 조사 (읽기 전용) |
| `compliance-reviewer` | 크롤러 규범 · 정책 위반 검사 |
| `docs-keeper` | 설계 문서 정합성 유지 |
