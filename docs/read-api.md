# ちいかわ 굿즈 알리미 — 읽기 API 계약

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | **유효** — 이대로 만든다. 형태를 바꾸면 `fe/`의 zod 스키마와 함께 바꾼다 |
| 버전 | v0.1 |
| 상위 문서 | [[tech-stack]] §2.8 (왜 API를 끼우는가) / [[plan]] §6 (화면 사양) |
| 관련 문서 | [[db-schema]] §12 (화면 질의) / `fe/CLAUDE.md` §3 (경계에서 zod로 파싱) |
| 범위 | **응답 형태와 판정 규칙.** 구현은 `be/src/api/` · `be/src/modules/catalog/` (`node dist/main api`), 소비는 `fe/src/lib/schema.ts` |

---

## 0. 요약

- 엔드포인트는 **3개**다. 화면 하나에 요청 하나 — **화면 단위 조립**이다 (§1.1)
- 세 응답이 공유하는 형태는 `Card` 하나다 (§2). 화면이 알아야 하는 것은 「뱃지와 날짜」뿐이다
- **뱃지 판정은 화면이 한다.** API는 `status`와 유효 예정 `schedules[]`를 **가공 없이** 준다 (§2.3)
- **섹션 판정은 API가 한다.** 홈 3섹션 · 아카이브의 소속은 서버가 정한다 (§3, §5)
- **게시 게이트**가 모든 응답에 걸린다. 허가 없는 소스의 `item`은 애초에 나오지 않는다 (§6)

---

## 1. 원칙

### 1.1 화면 단위 조립

`fe/CLAUDE.md` §4가 「홈은 서버에서 한 번 받고 클라이언트 로컬 필터」로 못박았다.
리소스 단위(`/items?status=…`)로 나누면 홈 하나에 요청이 3번 나가고, 필터 규칙이 양쪽에 생긴다.
**화면 하나 = 요청 하나.** 홈 3섹션은 한 응답에 들어온다.

대가: 카드 한 장이 캘린더에 두 번 실린다 (§4). 규모가 작아 받아들인다 — 홈은 20건, 캘린더는 한 달치다.

### 1.2 읽기 전용

v0에 쓰기 엔드포인트가 없다. 수동 교정([[plan]] §7)은 DB 직접 조작이다.
`GET`뿐이고 요청 본문이 없다. 검증 대상은 쿼리 문자열뿐이며 zod로 경계에서 파싱한다.

### 1.3 없는 정보를 만들지 않는다

- 브랜드 미판정은 `brand: null`로 준다. 화면이 `その他`로 **보여준다** ([[plan]] §6.6). 목록에서 빼지 않는다
- 예정 날짜는 `date` / `text` / `undecided` **3상태 그대로** 준다. `9月下旬`을 날짜로 만들지 않는다
- 이미지는 **원본 CDN URL 그대로**다. 프록시하지 않는다
- 본문 · 상품 설명문을 넣지 않는다. **제목 · 가격 · 날짜 · 링크**만

### 1.4 시각과 날짜

- 날짜는 전부 **JST 달력일** `YYYY-MM-DD`. 시각은 ISO 8601 (`2026-09-05T09:38:25.000Z`)
- 「오늘」은 **요청 시각의 JST 달력일**이다. 섹션 판정(§3.2)의 기준점이고 응답의 `today`로 돌려준다
- `bigint` id는 **문자열**이다. pg 드라이버가 그렇게 주고, JS `number`는 2^53에서 깨진다

---

## 2. 공통 형태

### 2.1 `Card` — 굿즈 1건

세 화면이 같은 카드를 그린다 ([[plan]] §6.3). 필드는 `item` 테이블에서 오되 **테이블명 · 3층 구조는 새지 않는다.**

```ts
interface Card {
  id: string;
  title: string;
  officialUrl: string;
  imageUrl: string | null;        // 원본 CDN. 이미지 게이트(§6.2) 미허가면 null
  price: number | null;           // JPY 정수. variant 간 최저가
  priceVaries: boolean;
  brand: { code: string; label: string } | null;  // null = 미판정 → その他
  channel: Channel;               // 'online_official' | 'konbini' | 'arcade' | 'gacha' | 'kuji' | 'store' | 'apparel'
  region: string;                 // 'online' | 'national' | 'tokyo' | …
  acquisition: 'fixed' | 'random';
  seriesTotal: number | null;     // random이면 반드시 있다 (`全N種`)
  labels: string[];
  status: 'UPCOMING' | 'ON_SALE' | 'ENDED';
  statusAt: string;               // 현재 상태가 된 시각
  preorderOn: string | null;      // 예약 개시 JST 달력일
  releaseOn: string | null;       // 발매 JST 달력일
  timeEstimated: boolean;         // 개시 시각은 추정치다 ([[plan]] §3.4). 화면은 `頃`를 붙인다
  availableUntil: string | null;
  restockedAt: string | null;     // 가장 최근 ENDED → ON_SALE 전이 시각. 📦 再入荷 뱃지의 근거
  schedules: Schedule[];          // 유효 예정 전부. 같은 kind가 2건 이상일 수 있다 (§2.3)
  sources: SourceRef[];           // 출처 표기 ([[plan]] §6.8). 1건 이상
}
```

- `restockedAt`은 **시각만** 준다. 「방금」의 폭(며칠까지 📦를 붙일지)은 화면의 표시 규칙이다.
  API가 `isRestocked: boolean`으로 잘라 주면 그 폭이 서버에 숨는다
- `seriesTotal`은 `acquisition='random'`일 때 NOT NULL이 DB 제약이다 (`CHK_item_random_total`)

### 2.2 `Schedule` — 유효 예정 1건

```ts
interface Schedule {
  kind: 'preorder' | 'release' | 'restock';
  date: string | null;            // 확정 날짜
  text: string | null;            // `9月下旬` 원문. 날짜로 바꾸지 않는다
  undecided: boolean;             // `再入荷未定`
  observedAt: string;             // 이 공지를 본 시각
}
```

`date` · `text` · `undecided` 중 하나는 있다 (`CHK_scheduled_event_has_content`).
v0 코드는 `date`만 채운다 — 본문 파싱이 없다. `text` · `undecided`는 형태만 예약돼 있다.

### 2.3 예정을 collapse하지 않는다

`schedules[]`는 `item_current_schedule` 뷰의 행 그대로다. **같은 `kind`가 2건 이상 올 수 있다.**
뷰가 `DISTINCT ON`을 일부러 뺐기 때문이다 ([[db-schema]] §12.1) — 백엔드의 supersede가 새면
여기서 두 줄로 드러난다. API가 여기서 하나를 고르면 그 탐지 지점이 없어진다.

화면의 `badge.ts`가 같은 `kind` 2건 이상을 **판정 불가**로 낸다 (`fe/CLAUDE.md` §5).

### 2.4 `SourceRef` — 출처 1건

```ts
interface SourceRef {
  code: string;                   // source.code — 'chiikawamarket'
  name: string;                   // source.name — 'ちいかわマーケット'
  url: string;                    // 그 소스에서 이 굿즈를 본 페이지
  observedAt: string;             // 마지막으로 본 시각
}
```

소스 하나에 1건이다. 같은 소스의 mention이 여럿(내용 변경 이력)이면 **가장 최근 것**의 `url` · `observedAt`.
게시 게이트(§6)를 지나온 소스만 있으므로 `sources[]`의 소스는 전부 허가된 소스다 —
밝힐 수 없는 경로는 목록에 없다.

---

## 3. `GET /home` — 홈 3섹션

[[plan]] §6.2. 3섹션을 한 번에 준다.

```ts
interface HomeResponse {
  generatedAt: string;
  today: string;                  // 섹션 판정의 기준 JST 달력일
  onSale: Card[];                 // 🟢 今すぐ買えるもの
  upcoming: Card[];               // 🔜 もうすぐ
  waitable: Card[];               // 🔵 再入荷を待てるもの
}
```

### 3.1 섹션 판정

| 섹션 | 조건 | 정렬 |
| --- | --- | --- |
| `onSale` | `status = ON_SALE` | `statusAt` 내림차순 — 최근 열린 것이 위 |
| `upcoming` | `status = UPCOMING` AND 유효 예정 `preorder`·`release` 중 `date ≤ today + 8` | 그 날짜 오름차순 |
| `waitable` | `status = ENDED` AND 유효 `restock` 예정 있음 AND NOT `undecided` | `date` 오름차순, `text`만 있는 것은 뒤 |

「8일 전 ~ 당일」이 `upcoming`이다. 그보다 먼 `UPCOMING`은 홈에 없고 **캘린더에만** 있다.

### 3.2 홈에 없는 것

| 항목 | 어디로 |
| --- | --- |
| `UPCOMING` + 예정이 `today + 8`보다 뒤 | 캘린더 (§4) |
| `UPCOMING` + 유효 예정 없음 (날짜가 지났는데 재관측이 없다) | 어디에도 없다. 수집 지연이다 — 감시 대상 |
| `ENDED` + `restock` 예정이 `undecided` (⚪️ 再入荷未定) | 아카이브 (§5). 「판단 못 한다」는 「기다린다」가 아니다 ([[plan]] §3.2) |
| `ENDED` + 예정 없음 (🔴 完売) | 아카이브 (§5) |

섹션은 **서로 배타**다. 한 카드가 두 섹션에 들어가지 않는다.

### 3.3 필터는 응답에 없다

채널 · 브랜드 · ランダム除く · オンラインのみ는 **클라이언트 로컬 필터**다 (`fe/CLAUDE.md` §4).
쿼리 파라미터를 받지 않는다. 카드에 `channel` · `brand` · `acquisition` · `region`이 있으므로 화면이 거른다.

---

## 4. `GET /calendar` — 사건

[[plan]] §6.4. **굿즈가 아니라 사건**이다. 같은 굿즈가 예약일과 발매일에 두 번 나온다.

```
GET /calendar?from=2026-09-01&to=2026-09-30
```

| 파라미터 | 기본값 | 제약 |
| --- | --- | --- |
| `from` | `today`가 속한 달의 1일 | `YYYY-MM-DD` |
| `to` | 그 달의 말일 | `from ≤ to`, `to − from` 62일 이하 (두 달치) |

```ts
interface CalendarResponse {
  generatedAt: string;
  today: string;
  from: string;
  to: string;
  events: CalendarEvent[];        // date 오름차순 → channel → title
}

interface CalendarEvent {
  date: string;                   // JST 달력일. 이 날에 무엇이 있는가
  kind: 'preorder' | 'release' | 'restock';
  item: Card;
}
```

### 4.1 사건의 출처

| `kind` | 근거 | 과거 / 미래 |
| --- | --- | --- |
| `preorder` | `Card.preorderOn` | 양쪽 |
| `release` | `Card.releaseOn` | 양쪽 |
| `restock` | 유효 `restock` 예정 중 **`date`가 있는 것** | 미래 (예고) |
| `restock` | 관측된 `ENDED → ON_SALE` 전이 · 재입고 태그 백필 | 과거 (실제) |

**날짜가 확정된 것만 놓는다.** `9月下旬`은 캘린더에 놓을 자리가 없다 — 홈 `waitable`에만 나온다.

「날짜 안에서 채널로 묶기」는 화면이 한다. 정렬을 그 순서로 주므로 순회하며 그룹을 끊으면 된다.
채널 순서는 `Channel` 유니온의 선언 순서다.

---

## 5. `GET /archive` — 過去 / 完売

v0에서 **페이지네이션이 필요한 유일한 곳**이다. `ENDED`가 계속 쌓인다.

```
GET /archive?limit=30
GET /archive?limit=30&cursor=MjAyNi0wOS0wMVQwMjowMDowMC4wMDBafDYxMg
```

| 파라미터 | 기본값 | 제약 |
| --- | --- | --- |
| `limit` | 30 | 1 ~ 100 |
| `cursor` | 없음 (첫 페이지) | 이전 응답의 `nextCursor` 그대로. 해석하지 않는다 |

```ts
interface ArchiveResponse {
  generatedAt: string;
  items: Card[];                  // statusAt 내림차순 → id 내림차순
  nextCursor: string | null;      // null = 마지막 페이지
}
```

### 5.1 소속

`status = ENDED` **이면서 홈 `waitable`이 아닌 것.** 재입고가 예고된 것은 「기다릴 수 있는 것」이지 과거가 아니다.
⚪️ 再入荷未定은 여기다.

### 5.2 커서다. 오프셋이 아니다

30분마다 수집이 돌고 `ENDED`가 위에 끼어든다. 오프셋이면 다음 페이지에서 **같은 카드를 또 본다.**
커서는 `(statusAt, id)` keyset이다 — 사이에 행이 끼어도 이어진다.

커서 값은 불투명 문자열이다. 화면은 저장했다가 그대로 돌려준다. 형식이 바뀌어도 화면은 모른다.
**깨진 커서는 `400`이다.** 첫 페이지로 조용히 돌아가지 않는다 — 무한 스크롤이 처음부터 다시 붙는다.

---

## 6. 게시 게이트

[[plan]] §8.1 「소스별 게시 허가」. **`source.enabled`는 수집 게이트지 게시 게이트가 아니다.**
`item` 테이블에 있다고 화면에 나오는 것이 아니다.

| 컬럼 (`source`) | 의미 | NULL이면 |
| --- | --- | --- |
| `publish_allowed_at` | 이 소스의 정보를 화면에 내도 된다는 회신을 받은 시각 | 이 소스의 `item`은 **어느 응답에도 없다** |
| `image_allowed_at` | 이미지 인라인 참조까지 허가된 시각 | `imageUrl`이 **`null`**이다. 카드는 선다 |

### 6.1 판정 단위는 소스, 적용 단위는 item

`item`에 `source_id`가 없다. `item_mention → mention → source`로 판정한다.

- **연결된 소스 전부**가 `publish_allowed_at IS NOT NULL`이어야 나온다. 하나라도 미허가면 빠진다.
  병합된 굿즈에 미허가 소스가 섞이면 그 카드 전체가 빠진다 — 밝힐 수 없는 경로의 정보를
  카드 일부라도 싣지 않는다
- 연결된 mention이 없는 `item`은 나오지 않는다. 근거가 없는 카드다
- 삭제 요청은 `publish_allowed_at = NULL`로 돌린다. `enabled=false`만으로는 이미 만들어진 `item`이 내려가지 않는다

### 6.2 이미지 게이트도 같은 규칙

연결된 소스 **전부**가 `image_allowed_at IS NOT NULL`일 때만 `imageUrl`을 낸다. 아니면 `null`.
화면은 「있으면 그린다」만 한다 — 게이트를 `fe/`에 두지 않는다 (#13 F3).

**이미지 한 장만 내리는 레버는 아직 없다.** 게이트가 소스 단위라, 특정 이미지의 삭제 요청에는
카드 전체 억제(`suppressed_at`)나 소스 전체 이미지 차단으로만 답할 수 있다. 정규화가 `image_url`을
매번 다시 채우므로 수동으로 비워도 되돌아온다. [[plan]] §2.1 미해결 항목이고, 회신 내용을 보고 정한다 —
회신 전에는 `image_allowed_at`이 전부 NULL이라 이미지가 아예 나가지 않는다.

### 6.3 모든 응답에 붙는 조건

```
suppressed_at IS NULL                    -- 억제 ([[db-schema]] §5.2)
AND 연결 소스 전부 publish_allowed_at IS NOT NULL
AND 연결 mention 1건 이상
```

**로컬 개발에서는** `psql`로 로컬 DB의 `source`에 직접 찍는다. 우회 플래그를 만들지 않는다 —
프로덕션에 그 플래그가 켜진 채 나가는 경로를 만들지 않는다.

---

## 7. 오류

| 상황 | 응답 |
| --- | --- |
| 쿼리 파라미터 형식 위반 · 깨진 커서 | `400` + `{ message, issues[] }` (zod issues) |
| 없는 경로 | `404` |
| 그 외 | `500`. 본문에 스택을 내지 않는다 |

빈 결과는 오류가 아니다. `[]`와 `nextCursor: null`이다.

---

## 8. 미결정

| # | 항목 | 선택지 | 필요 시점 |
| --- | --- | --- | --- |
| 1 | API 서비스의 인증 | Cloud Run 서비스 간 ID 토큰(`run.invoker`) / 공개 + 읽기 전용 | `infra/` 착수 시. 응답 형태에 영향 없음 |
| 2 | 캐시 헤더 (`Cache-Control`) | 화면 쪽 `revalidate`만으로 충분한지 | 운용 후 |

---

## 관련 문서

- [[plan]] §6 화면 · §8.1 게시 게이트
- [[tech-stack]] §2.8 왜 API를 끼우는가
- [[db-schema]] §2 `source` 컬럼 · §12 화면 질의
- `be/CLAUDE.md` §1 진입점 · `fe/CLAUDE.md` §3 경계
