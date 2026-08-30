# fe/ 아키텍처 규칙

`fe/` 안의 모든 작업에 적용된다. **여기 없는 구조를 즉흥으로 만들지 않는다.**

## 이 문서의 담당 범위

| 문서 | 담당 |
| --- | --- |
| **`fe/CLAUDE.md`** (이 문서) | **구조 · 레이어 경계 · 렌더링 · 데이터 흐름** |
| `.claude/agents/frontend-dev.md` | 디자인(Apple HIG) · 화면 규약 · 공식문서 URL |
| `docs/plan.md` §6 | 화면 사양 (무엇을 보여주는가) |
| `prototype/index.html` | 레이아웃·뱃지·필터의 검증된 원안 |
| 이 문서 맨 아래 마커 블록 | **Next.js가 관리한다.** 설치된 버전의 문서 위치를 가리킨다 |

같은 규칙을 두 곳에 쓰지 않는다. 디자인 질문은 `frontend-dev.md`로 간다.

---

## 1. 렌더링 기본값은 서버 컴포넌트다

**`'use client'`는 기본값이 아니라 예외다.** 붙이려면 아래 중 하나에 해당해야 한다.

- 사용자 입력을 받는다 (필터 칩, 체크박스, 탭)
- 브라우저 API를 쓴다 (`localStorage`, `matchMedia`)
- React 훅 중 상태·효과가 필요하다 (`useState`, `useEffect`)

해당하지 않으면 붙이지 않는다. **"컴포넌트니까 붙인다"는 이유가 아니다.**

`'use client'`는 **트리의 잎에 붙인다.** 페이지나 레이아웃에 붙이면 그 아래 전부가 클라이언트가 된다.
필터가 필요하면 필터 컴포넌트만 클라이언트로 만들고, 목록은 서버에서 만들어 `children`으로 넘긴다.

### 왜 이 기본값인가

`tomomachi-fe`는 25개 page 중 21개가 `'use client'`다. **그건 그 제품이 맞다** — LINE 로그인,
인증 게이트, 채팅이 있다. **이 프로젝트는 반대다.**

| | `tomomachi` | 이 프로젝트 |
| --- | --- | --- |
| 인증 | LINE 로그인 | 없다 |
| 쓰기 | mutation 다수 | **v0에 0개** |
| 유입 경로 | 앱 설치 · 초대 | **검색뿐** — 광고를 못 쓴다 (무수익) |
| 데이터 변화 | 실시간 | **30분마다** |

검색이 유일한 획득 경로다. 클라이언트 렌더링은 그걸 직접 깎는다.
그리고 데이터가 30분마다만 바뀌니 서버 캐시가 그대로 맞는다.

---

## 2. 디렉토리

```
fe/
├── src/
│   ├── app/                  라우트. 데이터 페치 + 화면 조립만
│   ├── modules/              도메인 단위
│   │   ├── _common/          도메인 없는 UI 원소 (뱃지 · 칩 · 섹션 헤더)
│   │   └── <도메인>/
│   │       ├── components/
│   │       ├── hooks/        클라이언트 훅. 없으면 만들지 않는다
│   │       ├── types.ts
│   │       └── consts.ts
│   └── lib/                  도메인 없는 인프라 · 순수함수
└── (설정 파일들)
```

- **`modules`다.** `features`가 아니다. `tomomachi-fe`와 같은 이름을 쓴다 — 혼자 두 코드베이스를 오간다
- **`lib/`와 `utils/`를 나누지 않는다.** `tomomachi`는 나눠 놨고 경계가 흐려졌다. `lib/` 하나다
- **`store/`를 만들지 않는다.** 클라이언트 전역 상태가 없다. zustand 미사용
- 디렉토리는 **필요해질 때 만든다.** 빈 `hooks/`·`utils/`를 미리 두지 않는다

### 의존 방향은 단방향이다

```
app/  →  modules/<도메인>/  →  modules/_common/  →  lib/
```

- `lib/`는 아무것도 import하지 않는다 (외부 패키지만)
- `_common/`은 특정 도메인을 모른다
- **도메인끼리 서로 import하지 않는다.** 둘이 필요하면 `_common/`으로 올리거나 `app/`에서 조립한다
- `modules/`는 `app/`을 import하지 않는다

이 방향이 깨지려는 순간이 **레이어를 잘못 잡았다는 신호**다. 우회 import로 넘기지 않는다.

### `@/` alias

`@/`는 `src/`다. 상대경로 `../../`를 쓰지 않는다.

---

## 3. 데이터는 백엔드 읽기 API에서만 온다

**`fe/`는 데이터베이스를 모른다.** `pg`를 설치하지 않는다. SQL을 쓰지 않는다.
테이블명·뷰명(`mention`, `item_current_schedule` 등)이 `fe/` 코드에 등장하면 잘못됐다.
근거는 `docs/tech-stack.md` §2.8.

```
be/ 읽기 API  →  app/의 서버 컴포넌트  →  화면
```

### 경계에서 zod로 파싱한다

API 응답을 타입 단정(`as`)으로 받지 않는다. **`lib/`의 zod 스키마로 파싱한다.**

- 스키마가 유일한 타입 출처다. `z.infer`로 타입을 얻는다
- 파싱 실패는 **조용히 넘기지 않는다.** 그 항목을 화면에서 빼고 로그를 남긴다
- 백엔드가 스키마를 바꾸면 여기서 터진다. 그게 목적이다

### 캐싱

읽기 전용이고 수집이 30분 주기다. `fetch`의 `revalidate`로 서버에서 캐시한다.
**폴링으로 데이터를 새로 받지 않는다.** 수집보다 자주 갱신할 이유가 없다.

---

## 4. TanStack Query의 역할은 좁다

기본값은 **서버 컴포넌트 페치**다. Query는 아래에만 쓴다.

- 아카이브(`過去 / 完売`) 페이지네이션처럼 **클라이언트에서 추가 요청**이 나가는 곳

**홈과 캘린더의 필터는 Query를 쓰지 않는다.** 홈은 3섹션 합쳐 20건 규모다
(`plan.md` §6.2). 서버에서 한 번 받고 **클라이언트 컴포넌트의 로컬 상태로 필터**한다.
왕복이 없다. 필터 하나에 요청을 날리지 않는다.

`QueryProvider`가 `src/app/providers/`에 이미 있다. **여기서 클라이언트 전역 상태를 관리하지 않는다.**

---

## 5. 판정 로직은 컴포넌트에 넣지 않는다

JSX 안에서 판정하면 테스트할 수 없다. 아래 2개는 **순수함수로 격리하고 테스트한다.**

### `modules/item/badge.ts` — 뱃지 판정

뱃지는 **상태 + 가장 가까운 예정**의 조합이고 종류가 7개다 (`plan.md` §3.2).
**상태만으로 판정하지 않는다.** 이 프로젝트에서 가장 틀리기 쉬운 코드다.

**예정 행이 2개 이상 올 수 있다.** `item_current_schedule` 뷰는 `DISTINCT ON`을
**의도적으로 뺐다** (`docs/db-schema.md`) — 백엔드의 supersede 로직이 새면 중복이 눈에 보이게 올라온다.
그 중복이 여기로 온다.

**조용히 첫 행을 고르지 않는다.** 이상을 드러낸다 — 로그를 남기고, 뱃지는 판정 불가로 낸다.
「없는 정보를 만들지 않는다」가 여기서 실행된다.

### `lib/format.ts` — 표기

날짜는 `date` / `text` / `undecided` **3가지 상태**로 온다. `9月下旬`은 날짜가 아니다.

- **정규화 못 한 값을 날짜로 만들지 않는다.** 원문 그대로 낸다
- 추정값(`18:00頃`)은 확정값과 **시각적으로 구분**한다
- 일본 관례를 따른다 — `¥2,970` · `8/25(月) 18:00頃` · `全8種`

### 테스트

`badge.ts`·`format.ts`에 테스트를 붙인다. JSX가 없는 순수함수다.
**러너는 `be/`와 같은 jest다.** v0에 컴포넌트 테스트 스택을 넣지 않는다.

> 아직 `fe/`에 jest가 설치돼 있지 않다. 첫 판정 로직을 쓸 때 함께 넣는다.

---

## 6. 하지 않는 것

- **`'use client'`를 page/layout에 붙이지 않는다** (§1)
- **`pg`·SQL·테이블명을 `fe/`에 넣지 않는다** (§3)
- **웹폰트를 로드하지 않는다.** 시스템 폰트 스택. 일본어 웹폰트는 무겁다
- **`next/image`를 쓰지 않는다.** 최적화 대상이 우리 파일이 아니다.
  평범한 `<img loading="lazy">`를 쓴다. 실패(404 · referer 차단)하면 자리만 비우고
  카드는 그대로 선다. 레이아웃을 무너뜨리지 않는다. 카드 1건에 **1장.** 갤러리를 만들지 않는다
- **`next.config.ts`의 `images.unoptimized`를 지우지 않고 `remotePatterns`를 추가하지 않는다.**
  `next/image`가 원격 이미지를 받으면 우리 서버가 재서빙하게 된다 — [[plan]] §2.1이 버린 안 B다.
  설정이 가드고, 이 규칙은 그 가드를 설명할 뿐이다
- **이미지 파일을 우리 저장소에 두지 않는다** — `img src`가 원본 CDN을 그대로 가리킨다

> [!warning] **회신 전에는 이미지를 공개 화면에 내지 않는다**
> 인라인 참조를 할 **권한이 아직 없다.** 운영사 규약의 「공표」에 해당하는지 미판정이고
> ToS 문의 회신을 기다리는 중이다 — 근거와 미해결 6건은 [[plan]] §2.1,
> 게이트는 [[plan]] §8.1 v0 착수 조건에 있다.
> 카드를 만드는 것은 막지 않는다. **공개**가 막힌다. 로컬·픽스처 개발은 그대로 한다.
> curl 실측은 「막혀 있지 않다」이지 「허용됐다」가 아니다 (한계 4개도 §2.1)
- **색을 컴포넌트에 hex로 박지 않는다.** `globals.css`의 시맨틱 토큰만 쓴다.
  새 색이 필요하면 토큰을 추가한다
- **`apis/<도메인>/{index,queries}.ts` 2층 구조를 만들지 않는다** (`tomomachi` 패턴).
  v0에 mutation이 0개라 절반이 죽은 코드가 된다
- **`any`·타입 단정(`as`)으로 API 응답을 받지 않는다** (§3)
- **맨 아래 `nextjs-agent-rules` 마커 블록을 지우지 않는다.** `next dev`가 다시 써넣는다.
  마커 **밖은** 건드리지 않으니 우리 규칙과 섞이지 않는다. 버전을 올리면 그 블록만 갈린다.
  (`AGENTS.md`는 지웠다 — 이 블록이 `CLAUDE.md`에 있으면 다시 만들지 않는다)

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
