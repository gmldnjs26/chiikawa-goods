# CLAUDE.md

ちいかわ 굿즈 정보를 한 곳에 모아 타임라인과 알림으로 제공하는 개인 프로젝트.

## 설계 문서를 먼저 읽는다

작업 전에 해당 문서를 읽는다. 여기 없는 내용을 추측으로 만들지 않는다.

| 문서 | 내용 |
| --- | --- |
| `docs/plan.md` | 제품 기획 · 차별점 · 비목표 · 마일스톤 |
| `docs/data-collection-design.md` | 데이터 3층 · 어댑터 계약 · 스케줄 |
| `docs/db-schema.md` | 테이블 · 제약 · 인덱스 |
| `docs/source-mapping.md` | 소스 원문 → 컬럼 매핑 · 태그 인벤토리 |
| `docs/tech-stack.md` | 기술 선정 근거 · 착수 전 검증 항목 |

**문서와 코드가 어긋나면 문서를 고친 뒤 코드를 고친다.** 반대로 하지 않는다.

### 문서 규약

- **파일명에 상태를 넣지 않는다.** `draft` `v2` `old` 금지. 파일명은 고정, 상태는 문서 안에
- 상태는 3개 — `초안`(뒤집힐 수 있다) / `유효`(이대로 만든다) / `대체됨`(어디로 갔는지 명시)
- 같은 결정을 두 문서에 복사하지 않는다. 한 곳에 두고 `[[문서]] §번호`로 참조한다
- **코드가 진실이 된 부분은 문서에서 뺀다.** 두 곳에 있으면 반드시 어긋나고,
  어긋난 문서는 안 읽히기 시작한다

| 문서 | 코드가 대체하는 부분 | 문서에 남기는 것 |
| --- | --- | --- |
| `db-schema.md` | DDL (migration이 진실) | 제약의 **이유** |
| `source-mapping.md` | 매핑 코드 · `config` 값 | 실측 근거 · 함정 목록 · 태그 인벤토리 |
| `data-collection-design.md` | 어댑터 구현 | 층 구분 · 규범 |
| `tech-stack.md` | `package.json` · Terraform | 선정 근거 · 버린 선택지 |
| `plan.md` | **없음** | 전부. 코드가 대체할 수 없는 유일한 문서 |

## 개발 순서

```
1. be/    NestJS 수집기 + PostgreSQL (로컬 docker)
2. fe/    Next.js 화면
3. infra/ GCP + Terraform   ← 1, 2가 끝난 뒤에 착수
```

**GCP는 마지막이다.** 로컬에서 `docker compose`로 Postgres를 띄우고 개발한다.
크레딧을 개발 기간에 태우지 않는다.

공통 스택: TypeScript / Node 22.18.0(volta 고정) / PostgreSQL.
세부 규약은 각 에이전트에 있다.

## 제품 불변식

이건 코드가 아니라 제품의 정의다. 여기서 벗어나는 요청은 그대로 실행하지 않고 먼저 되짚는다.

**차별점은 2개뿐이다** — 타임라인 + 푸시, 예약 사전 감지.

> 기능 추가 판별 질문: **"이거 블로그도 할 수 있나?"** → 예스면 하지 않는다.

**비목표** — 가격 비교 · 최저가 추적 · 이미지 호스팅 · 커뮤니티 · 검색 · 구매 대행.

**무수익** — 광고 · 어필리에이트 · 결제 코드를 넣지 않는다. 재류자격 문제다 (`plan.md` §2.3).

**우회 금지** — Cloudflare 챌린지, `robots.txt`가 막은 경로, CSR 전용 내부 API는 건드리지 않는다.
조사할 때도 마찬가지다. 취득 경로가 없으면 **"없음"으로 기록**하고 넘어간다.
한 번 차단당하면 그 소스를 영구히 잃는다.

**없는 정보를 만들지 않는다** — 판정 못 한 값은 비운다. 추측으로 채우지 않는다.
`9月下旬`을 날짜로 정규화하지 않고, 미판정 브랜드는 `その他`로 **보여준다.**

## 데이터 모델 요약

상세는 `docs/data-collection-design.md`.

```
mention   상대가 말한 것       불변. 절대 수정하지 않는다
item      우리가 정리한 것      가변
status_history   과거 전이     append-only
scheduled_event  미래 예정     append-only
```

- 상태는 `UPCOMING` / `ON_SALE` / `ENDED` **3개뿐이다.** 늘리지 않는다
- **`RESTOCK`은 상태가 아니라 `ENDED → ON_SALE` 전이다.** 반복된다
- 화면 뱃지 = 상태 + 가장 가까운 예정
- 삭제 요청은 `suppressed_at` / `source.enabled=false`. **하드 삭제 금지**

## 커밋

- 커밋 · 푸시는 **요청받았을 때만** 한다
- Conventional Commits. 무엇을 왜 바꿨는지 쓴다
- **커밋 금지**: `terraform.tfvars`, tfstate, 서비스 계정 키, DB 비밀번호, Webhook URL
- 저장소는 **public**이다. 자격 증명이 아닌 리소스 이름은 공개해도 된다

## 에이전트

작업 종류에 맞는 에이전트를 쓴다. 세부 규약은 각 에이전트가 갖고 있다.

| 에이전트 | 용도 |
| --- | --- |
| `collector-adapter-dev` | 수집 어댑터 · 파서 · 정규화 · 중복제거 (`be/`) |
| `schema-migration-dev` | TypeORM 엔티티 · migration |
| `frontend-dev` | Next.js 화면 (`fe/`) |
| `source-investigator` | 소스 실지 조사 (읽기 전용) |
| `compliance-reviewer` | 크롤러 규범 · 정책 위반 검사 (머지 전) |
| `docs-keeper` | 설계 문서 정합성 유지 |

수집 코드를 건드렸으면 머지 전에 `compliance-reviewer`를 돌린다.
