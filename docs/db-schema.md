# ちいかわ 굿즈 알리미 — 테이블 설계

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | **초안 (draft)** |
| 버전 | v0.1 |
| DB | PostgreSQL 16 / TypeORM 0.3 (migration-driven, `synchronize: false`) |
| 명명 | `typeorm-naming-strategies` snake_case. 테이블명 단수 |
| 상위 문서 | [[data-collection-design]] (데이터 층 정의) / [[tech-stack]] (§2.4) |
| 관련 문서 | [[source-mapping]] (소스 원문 → 테이블 필드 매핑) |
| 범위 | 스키마와 그 근거. DDL은 설계 표현용이며 실제 반영은 migration으로 한다 |

---

## 0. 전체 구조

```
source ──< collection_run
   │
   └──< mention ──< item_mention >── item ──> drop_group
                                      │
                                      ├──< status_history      과거
                                      ├──< scheduled_event     미래
                                      └──< notification        발송 기록 (v0.5+)
                       brand ─────────┘
                       merge_override (item ↔ item / mention 무시)
```

**설계 원칙 4개**

1. `mention`은 **불변**이다. 정규화 결과가 틀려도 원문은 남는다
2. **과거(`status_history`)와 미래(`scheduled_event`)를 분리한다.** 상태 컬럼을 늘리지 않는다
3. 어느 것도 **하드 삭제하지 않는다.** 삭제 요청은 `suppressed_at`으로 가린다
4. **Cloud SQL 고유 기능을 쓰지 않는다.** 표준 Postgres만 ([[tech-stack]] §2.6)

---

## 1. 공통 규약

| 항목 | 규약 |
| --- | --- |
| PK | `id bigint generated always as identity` |
| 시각 | `timestamptz`. 애플리케이션은 UTC로 다루고 표시만 JST |
| 캘린더 날짜 | `date` (JST 기준 달력일). 발매일·예약일은 **시각이 아니라 날짜**다 |
| 예약어 | **`drop`은 SQL 예약어다.** 테이블명은 `drop_group`, 컬럼은 `drop_id`. 문서 본문의 "drop"은 도메인 용어로만 쓴다 |
| 열거값 | **`text` + `CHECK`.** Postgres `enum` 타입은 값 추가에 `ALTER TYPE`이 필요해 migration이 무거워진다 |
| 금액 | `integer` (JPY, 소수 없음). 세금 포함 여부는 `price_tax_included` |
| 생성/갱신 | `created_at` / `updated_at timestamptz not null default now()` |

---

## 2. source — 소스 레지스트리

```sql
CREATE TABLE source (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          text NOT NULL UNIQUE,          -- 'chiikawa_market', 'nagano_market'
  name          text NOT NULL,
  kind          text NOT NULL,                 -- CHECK: official_store|fan_blog|press|konbini|prize|gacha|apparel|retail
  platform      text NOT NULL,                 -- 'shopify','wordpress','nextjs','custom' — 어댑터 선택 키
  fetch_kind    text NOT NULL,                 -- CHECK: json|rss|atom|html|sitemap
  config        jsonb NOT NULL DEFAULT '{}',   -- 사이트별 파싱 규칙 (태그 날짜 형식 등)
  base_url      text NOT NULL,
  channel       text NOT NULL,                 -- 이 소스에서 나온 item의 기본 채널 (§5)
  interval_sec  integer NOT NULL,
  crawl_delay_sec integer NOT NULL DEFAULT 0,  -- robots.txt 준수값
  enabled       boolean NOT NULL DEFAULT true, -- 킬 스위치
  disabled_reason text,                        -- 차단·삭제요청 등 정지 사유
  silence_alert_sec integer,                   -- 이 시간 이상 신규가 없으면 무음 경보
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

- `enabled`는 **소스 단위 킬 스위치**다. 403/429/챌린지 수신 시 애플리케이션이 스스로 내린다
- `silence_alert_sec`가 **조용한 실패**를 잡는다. 소스마다 기대 빈도가 다르므로 소스별 값이다
- `channel`을 여기 두는 이유는 §5

**시드**는 migration에 넣는다. 소스 추가 = migration 1개.

> [!important] `platform`이 어댑터를 고르고, `config`가 차이를 흡수한다
> Shopify 스토어 3곳이 **같은 어댑터 코드**를 쓰지만 태그 규칙이 다르다 —
> `chiikawamarket.jp`는 `20260821`, `chiikawamogumogu.shop`은 `2026年8月7日発売商品`이다.
> 정규식을 코드에 박으면 스토어 추가마다 배포가 필요하다. `config`에 둔다.
>
> ```json
> { "release_tag": "^(\\d{8})$",
>   "preorder_tag": "^PRE(\\d{8})$",
>   "restock_tag": "^RE(\\d{8})$",
>   "upcoming_tag": "販売開始前" }
> ```

---

## 3. collection_run — 수집 실행 기록

```sql
CREATE TABLE collection_run (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id     bigint NOT NULL REFERENCES source(id),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  status        text NOT NULL,        -- CHECK: running|success|failed|skipped_locked|skipped_idle
  mention_count integer NOT NULL DEFAULT 0,
  new_count     integer NOT NULL DEFAULT 0,
  excluded_count integer NOT NULL DEFAULT 0,   -- 관련성 필터로 제외한 건수
  http_status   integer,
  failure_kind  text,                 -- CHECK: network|http|validation|parse|blocked
  error_message text
);
CREATE INDEX ON collection_run (source_id, started_at DESC);
```

> [!important] `source.last_success_at` 컬럼을 두지 않는다
> 실행 이력에서 파생되는 값이다. 컬럼으로 중복해서 들고 있으면 반드시 어긋난다.
> 헬스 판정은 `collection_run` 조회로 한다.

`status`에 스킵 2종이 있다 ([[data-collection-design]] §6.1–6.2).

| 값 | 의미 |
| --- | --- |
| `skipped_idle` | 창구 폴링인데 오늘 예정이 없어 외부 요청 없이 종료 |
| `skipped_locked` | 앞선 실행이 아직 돌고 있어 종료. **자주 나오면 주기가 너무 짧다** |

`failure_kind`에 **`validation`이 따로 있다.** 본문 검증 실패(소프트 404)는 성공이 아니라 실패다
([[data-collection-design]] §7). `http_status`가 200이어도 여기 실패로 남는다.

---

## 4. mention — 원문 관측 (불변)

```sql
CREATE TABLE mention (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id       bigint NOT NULL REFERENCES source(id),
  collection_run_id bigint REFERENCES collection_run(id),
  external_id     text NOT NULL,          -- 소스 고유 ID. dedupe 키
  url             text NOT NULL,
  raw_title       text NOT NULL,
  raw_payload     jsonb,                  -- 90일 후 NULL 처리 (본문만 삭제)
  payload_hash    text NOT NULL,          -- 내용 변경 판정
  payload_purged_at timestamptz,
  relevance       text NOT NULL DEFAULT 'included',  -- CHECK: included|mixed|excluded
  observed_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id, payload_hash)
);
CREATE INDEX ON mention (source_id, observed_at DESC);
CREATE INDEX ON mention (observed_at)
  WHERE raw_payload IS NOT NULL;          -- 정리 배치용: 90일 경과 + 본문 잔존
```

> [!important] UNIQUE에 `payload_hash`가 들어간다
> `(source_id, external_id)`만으로 잡으면 **내용이 바뀌어도 새 행이 안 생긴다.**
> 해시를 포함하면 — 같은 내용 재관측은 무시되고(§10.1 보존 규칙), 내용이 바뀌면 새 행이 쌓여
> 변경 이력이 된다. 이게 파서 회귀 검증의 근거다.

> [!important] `relevance='excluded'`는 치이카와가 아닌 상품이다
> `nagano-market.jp`는 나가노의 다른 작품과 섞인 스토어다. 제외 대상도 **행은 남긴다**
> (제목·URL·태그만, `raw_payload` 없이). 필터 규칙이 틀렸을 때 재처리로 복구하기 위해서다.
> 판정 규칙은 [[source-mapping]] §7.
>
> `excluded_count`의 **비율이 급변하면 경보**다. 평소 70% 제외가 99%가 되면 태그 체계가 바뀐 것이다.

**행은 영구, 본문만 90일.** `raw_payload`를 `NULL`로 만들고 `payload_purged_at`을 찍는다.
행 자체를 지우면 감사 추적이 끊긴다 ([[tech-stack]] §2.7).

---

## 5. brand / item — 굿즈

### 5.1 brand (룩업 테이블)

```sql
CREATE TABLE brand (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code         text NOT NULL UNIQUE,   -- 'chiikawa_market','pocket','mogumogu','ichiban_kuji'
  label_ja     text NOT NULL,          -- 'ちいかわマーケット'
  match_rules  jsonb,                  -- 컬렉션/태그/제목 매칭 규칙
  sort_order   integer NOT NULL DEFAULT 100,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

**브랜드만 별도 테이블인 이유**: 브랜드는 계속 늘어난다. `CHECK` 제약이면 값 추가마다 migration이고,
판정 규칙(`match_rules`)을 코드에 하드코딩하면 규칙 수정에 배포가 필요하다.
채널·상태는 반대로 거의 안 변하므로 `CHECK`로 충분하다.

`brand_id`가 `NULL`이면 미판정이고, 화면에는 `その他`로 **표시한다** ([[plan-draft]] §6.6).

### 5.2 item

```sql
CREATE TABLE item (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  drop_id       bigint REFERENCES drop_group(id),
  brand_id      bigint REFERENCES brand(id),     -- NULL = 미판정
  title         text NOT NULL,
  title_norm    text NOT NULL,                   -- 정규화 제목 (§9.2 dedupe용)
  canonical_url text UNIQUE,                     -- 소스 간 동일 판정 1순위
  official_url  text NOT NULL,
  image_url     text,                            -- 링크만. 파일은 갖지 않는다
  price         integer,                -- variant 간 차이가 있으면 최저가
  price_varies  boolean NOT NULL DEFAULT false,
  price_tax_included boolean,          -- 공식 스토어는 true 고정 (표시가 税込)
  variant_available integer,           -- 재고 있는 variant 수. '一部品切れ' 표시용
  variant_total     integer,
  category      text,                  -- Shopify product_type: 'Tシャツ・パーカー'
  vendor        text,                  -- 제조사: 'トーキング'. 브랜드와 다르다

  -- 분류 (화면 필터의 근거)
  channel       text NOT NULL,   -- CHECK: online_official|konbini|arcade|gacha|kuji|store|apparel
  acquisition   text NOT NULL,   -- CHECK: fixed|random
  series_total  integer,         -- random일 때 총 종류 수
  region        text NOT NULL DEFAULT 'online',  -- online|national|tokyo|osaka|nagoya|...
  labels        text[] NOT NULL DEFAULT '{}',    -- '川越店限定','ハチワレ' 등 정보 라벨

  -- 상태 (현재값. 이력은 status_history)
  status        text NOT NULL,   -- CHECK: UPCOMING|ON_SALE|ENDED
  status_at     timestamptz NOT NULL DEFAULT now(),

  -- 날짜 (JST 달력일)
  preorder_on   date,
  release_on    date,
  time_estimated boolean NOT NULL DEFAULT true,  -- 개시 시각은 추정값
  available_until date,

  suppressed_at timestamptz,      -- 삭제 요청 대응. 하드 삭제하지 않는다
  suppressed_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT item_random_total CHECK (acquisition <> 'random' OR series_total IS NOT NULL),
  CONSTRAINT item_store_region CHECK (channel <> 'store' OR region <> 'online')
);

CREATE INDEX ON item (status, release_on) WHERE suppressed_at IS NULL;
CREATE INDEX ON item (channel)            WHERE suppressed_at IS NULL;
CREATE INDEX ON item (brand_id)           WHERE suppressed_at IS NULL;
CREATE INDEX ON item (title_norm);
CREATE INDEX ON item USING gin (labels);
```

**`channel`을 `item`에 비정규화해 둔다.** 소스에서 파생되는 값이지만
(`source.channel`), 화면 필터가 전부 이 컬럼을 때리고 병합 시 소스가 여럿이 된다.
파생을 매번 조인으로 풀면 대표 소스를 정하는 문제가 생긴다.

> [!note] `sale_final`을 뺐다 (2026-08-23 실지 확인)
> 공식 스토어의 품절 표기는 **「売り切れ」 하나뿐**이고 `完売`/`販売終了`를 구분하지 않는다.
> **소스에서 판정할 수 없는 값은 컬럼으로 두지 않는다.** 화면도 `完売` 하나로 낸다.

> [!note] `region`은 도시 단위까지 (`online` `national` `tokyo` `osaka` `nagoya` …)
> 팝업·실점포가 대부분 대도시에 열리므로 도시 단위가 실용적이다.
> v0에서 실제로 쓰이는 값은 `online`뿐이다.

> [!warning] `region`과 `labels`를 혼동하지 않는다
> `川越店限定` 상품은 **온라인에서 살 수 있다.** 지역 제약이 아니므로 `region`이 아니라 `labels`다.
> `region`은 **"내가 그 장소에 가야 하는가"** 일 때만 쓴다 ([[source-mapping]] §6.1).

`CHECK` 2개가 [[plan-draft]] §6.3의 카드 규약을 DB에서 강제한다 —
랜덤인데 종류 수가 없거나, 실점포인데 지역이 온라인인 카드는 애초에 저장되지 않는다.

---

## 6. drop_group — 발표 단위

> 도메인 용어는 `drop`이지만 **`drop`은 SQL 예약어**다. 테이블명은 `drop_group`으로 둔다.
> `FROM drop` / `REFERENCES drop(id)`는 큰따옴표 없이는 파싱되지 않고, TypeORM 엔티티명도 충돌한다.

```sql
CREATE TABLE drop_group (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title        text NOT NULL,
  kind         text NOT NULL,        -- CHECK: preorder|release|restock|campaign
  primary_date date,
  grouping_key text,                 -- 자동 묶음 근거 (예: 컬렉션 handle)
  is_manual    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON drop_group (primary_date DESC);
```

**묶음 규칙** (확정)

| 우선 | 기준 | `grouping_key` |
| --- | --- | --- |
| 1 | 공식 스토어 **컬렉션 소속** | 컬렉션 handle (`20260821`) |
| 2 | **같은 날짜 + 같은 브랜드 + 같은 `kind`** | `date:brand:kind` |
| 3 | 어느 쪽도 아니면 묶지 않는다 | `NULL` |

> [!warning] 브랜드 미판정(`brand_id IS NULL`)은 묶지 않는다
> 같은 날 `その他`끼리 전부 묶으면 **관계없는 굿즈가 한 발표로 뭉친다.**
> 미판정은 단독으로 낸다. 수동 교정으로 나중에 묶는다.

`kind`까지 키에 넣는 이유 — 같은 날 같은 브랜드에서 **예약 개시와 재입고가 동시에** 일어난다.
섞으면 알림 문구를 만들 수 없다.

`item.drop_id`는 **NULL 허용**이다. 묶이지 않은 `item`도 화면에는 단독으로 나온다.

---

## 7. item_mention — 출처 연결 (N:N)

```sql
CREATE TABLE item_mention (
  item_id    bigint NOT NULL REFERENCES item(id),
  mention_id bigint NOT NULL REFERENCES mention(id),
  role       text NOT NULL DEFAULT 'evidence',  -- CHECK: primary|evidence
  linked_by  text NOT NULL DEFAULT 'auto',      -- CHECK: auto|manual
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, mention_id)
);
CREATE INDEX ON item_mention (mention_id);
```

**하나의 굿즈가 여러 소스에서 온다.** 같은 一番くじ가 PR TIMES · 팬 블로그 · 공식에 각각 뜬다
([[data-collection-design]] §9.1). 이 테이블이 [[plan-draft]] §6.8 **출처 표기의 데이터 근거**다.

`role='primary'`가 공식 링크의 출처다.

---

## 8. status_history — 과거 (append-only)

```sql
CREATE TABLE status_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id     bigint NOT NULL REFERENCES item(id),
  status      text NOT NULL,        -- CHECK: UPCOMING|ON_SALE|ENDED
  observed_at timestamptz NOT NULL DEFAULT now(),
  mention_id  bigint REFERENCES mention(id),   -- 판정 근거
  is_backfilled boolean NOT NULL DEFAULT false, -- 태그에서 소급 생성한 행
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON status_history (item_id, observed_at DESC);
```

> [!warning] UNIQUE를 걸지 않는다
> `(item_id, status)`에 unique를 걸면 **재입고↔품절 반복을 기록할 수 없다.**
> `ENDED → ON_SALE → ENDED → ON_SALE`이 정상 이력이다.

**상태가 바뀔 때만** 행을 추가한다(매 폴링마다가 아니라). `item.status`는 최신 행의 사본이다.

> [!warning] `is_backfilled` 행을 실측 통계에 넣지 않는다
> `RE20260415` 같은 태그에서 되살린 행은 **날짜만 알고 시각은 모른다**(00:00 JST로 넣는다).
> 개시 시각 통계에 섞으면 "재입고는 0시에 일어난다"는 틀린 결론이 나온다.
> 백필 규칙은 [[source-mapping]] §3.4.

> [!important] v0 첫 커밋에 들어간다
> 나중에 추가하면 그 전 전이는 **소급 불가**다. v0에 알림이 없어도 이력은 쌓는다 —
> 알림 빈도를 실측으로 정할 유일한 근거다.

---

## 9. scheduled_event — 미래 (예정)

```sql
CREATE TABLE scheduled_event (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id     bigint NOT NULL REFERENCES item(id),
  kind        text NOT NULL,        -- CHECK: preorder|release|restock
  scheduled_on date,                -- 날짜가 확정된 경우만
  scheduled_text text,              -- '9月下旬' 원문 그대로
  undecided   boolean NOT NULL DEFAULT false,   -- '再入荷未定' 공지
  observed_at timestamptz NOT NULL DEFAULT now(),
  mention_id  bigint REFERENCES mention(id),
  superseded_at timestamptz,        -- 새 공지로 대체됨
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT sched_has_content CHECK (
    scheduled_on IS NOT NULL OR scheduled_text IS NOT NULL OR undecided
  )
);
CREATE INDEX ON scheduled_event (item_id, kind, observed_at DESC);
CREATE INDEX ON scheduled_event (scheduled_on)
  WHERE superseded_at IS NULL AND scheduled_on IS NOT NULL;
```

**append-only + `superseded_at`.** 공지는 갱신된다 — `9月下旬` → `9/15`.
덮어쓰면 "언제 무엇이 공지됐는지"가 사라진다. 새 행을 넣고 이전 행에 `superseded_at`을 찍는다.

> [!warning] `scheduled_text`를 날짜로 정규화하지 않는다
> `9月下旬`을 `9/21`로 바꾸면 **없는 정보를 만들어낸다.**
> 캘린더는 `scheduled_on IS NOT NULL`인 것만 배치하고, 나머지는 목록에만 낸다.

---

## 10. notification — 발송 기록 (v0.5+)

```sql
CREATE TABLE notification (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trigger_kind text NOT NULL,       -- CHECK: status_transition|schedule_new|schedule_d1
  status_history_id  bigint REFERENCES status_history(id),
  scheduled_event_id bigint REFERENCES scheduled_event(id),
  drop_id     bigint REFERENCES drop_group(id),
  channel     text NOT NULL,        -- CHECK: discord|web_push
  sent_at     timestamptz NOT NULL DEFAULT now()
);

-- 부분 유니크 인덱스로 건다. 테이블 제약으로 걸면 안 된다 (아래 경고)
CREATE UNIQUE INDEX ON notification (trigger_kind, status_history_id, channel)
  WHERE status_history_id IS NOT NULL;
CREATE UNIQUE INDEX ON notification (trigger_kind, scheduled_event_id, channel)
  WHERE scheduled_event_id IS NOT NULL;
```

> [!warning] `UNIQUE (…, status_history_id, …)`로 걸면 아무것도 막지 못한다
> Postgres의 UNIQUE는 기본적으로 **NULL을 서로 다른 값으로 취급**한다.
> 예정 트리거 행은 `status_history_id`가 NULL이므로 그 제약을 무한히 통과한다 — 반대도 마찬가지다.
> **이 테이블이 존재하는 유일한 이유가 정확히 그 지점에서 새어나간다.**
> 부분 유니크 인덱스로 NULL 행을 대상에서 빼거나, PG15+의 `NULLS NOT DISTINCT`를 쓴다.
> 여기서는 의도가 드러나는 부분 인덱스를 택한다.

> [!important] 중복 방지 키가 `(drop_id, trigger)`가 아니다
> 재입고는 같은 `drop`에서 **여러 번** 일어난다. `(drop_id, trigger)`에 unique를 걸면
> 2회차 재입고가 발화하지 않는다.
> **전이 1건(`status_history.id`) = 발송 1건**이 올바른 단위다.

`drop_id`는 묶음 표시용이지 중복 방지 키가 아니다.
v0에는 이 테이블이 없다. v0.5 migration에서 추가한다.

---

## 11. merge_override — 수동 교정

```sql
CREATE TABLE merge_override (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action      text NOT NULL,        -- CHECK: merge|unmerge|ignore_mention
  item_id     bigint REFERENCES item(id),
  other_item_id bigint REFERENCES item(id),
  mention_id  bigint REFERENCES mention(id),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

자동 병합만 두면 **틀린 병합을 고칠 방법이 없다.** 최소 3기능을 처음부터 만든다
([[data-collection-design]] §9.3).

`unmerge`는 자동 병합보다 **항상 우선한다.** 다음 수집이 다시 붙이면 안 되므로,
Deduper는 병합 전에 이 테이블을 먼저 본다.

---

## 12. 화면 질의

### 12.1 뱃지 판정

뱃지는 **상태 + 최신 예정**의 조합이다 ([[data-collection-design]] §3.3).
매번 조인이 필요하므로 뷰로 둔다.

```sql
CREATE VIEW item_current_schedule AS
SELECT item_id, kind, scheduled_on, scheduled_text, undecided, observed_at
  FROM scheduled_event
 WHERE superseded_at IS NULL;
```

> [!important] 유효 행 판정의 권한은 `superseded_at` 하나다
> `DISTINCT ON (item_id, kind) ORDER BY observed_at DESC`를 함께 쓰면
> supersede 로직이 한 건 놓쳤을 때 **조용히 한 행을 골라버린다.**
> 틀린 답이 그럴듯한 모습으로 나오는 것이 가장 나쁘다.
> 여기서는 `superseded_at`만 권한을 갖고, 중복이 생기면 **화면에 두 줄로 드러나게** 둔다.
> `(item_id, kind)` 유효 행이 2건 이상이면 경보를 낸다 — supersede 버그의 탐지 지점이다.

| 화면 섹션 | 조건 |
| --- | --- |
| 🟢 今すぐ買えるもの | `status='ON_SALE'` |
| 📦 再入荷 뱃지 | 최근 `status_history`가 `ENDED → ON_SALE` |
| 🔜 もうすぐ | `status='UPCOMING'` AND 예정일 ≤ D+8 |
| 🔵 再入荷を待てる | `status='ENDED'` AND restock 예정 존재 AND NOT `undecided` |
| ⚪️ 再入荷未定 | `status='ENDED'` AND restock 예정 `undecided` |
| 🔴 完売 / 販売終了 | `status='ENDED'` AND 예정 없음 (`sale_final`이면 販売終了) |

모든 화면 질의에 `suppressed_at IS NULL`이 붙는다.

---

## 13. 마이그레이션 순서

| 순서 | 내용 |
| --- | --- |
| 1 | `source` · `brand` · `collection_run` · `mention` |
| 2 | `drop_group` · `item` · `item_mention` |
| 3 | **`status_history` · `scheduled_event`** ← v0 첫 릴리스에 필수 |
| 4 | `merge_override` · `item_current_schedule` 뷰 |
| 5 | `notification` (v0.5) |

1~4가 v0다. FK 방향 때문에 `drop_group`이 `item`보다 앞선다.

---

## 14. 미결정

| # | 항목 | 영향 |
| --- | --- | --- |
| 1 | `ポケット` `もぐもぐ本舗` 전용 컬렉션 / 별도 EC 여부 | **v0 어댑터 수가 달라진다.** 컬렉션 목록 전량 재확인 필요 |
| 2 | `brand` 초기 목록과 `match_rules` 값 | 태그 기반으로 판정 가능함은 확인됨. 목록 자체는 미확정 |
| 3 | 편의점·프라이즈 소스의 세금 표기 | 공식 스토어는 `税込` 확정. 다른 소스는 미확인 |
| 4 | `category`(product_type) 값 정규화 여부 | 원문 그대로 둘지, 소수 카테고리로 매핑할지 |

**해소됨** — `region`(도시 단위) · `drop_group` 묶음 기준(§6) · `sale_final`(제거) ·
공식 스토어 `price_tax_included`(true 고정).
