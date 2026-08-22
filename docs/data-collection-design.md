# ちいかわ 굿즈 알리미 — 수집 · 데이터 설계

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | **초안 (draft)** |
| 버전 | v0.1 |
| 독자 | 개발자 |
| 상위 문서 | [[plan-draft]] (제품 기획) |
| 관련 문서 | [[tech-stack]] (기술 선정·ADR) |
| 범위 | 데이터 모델 · 수집 방식 · 정규화 규칙. **구현 코드 미포함** |

> 제품이 왜 이렇게 동작해야 하는가는 [[plan-draft]]에 있다. 본 문서는 **어떻게**만 다룬다.

---

## 0. 파이프라인

```
Scheduler (Asia/Tokyo)
   └─▶ Job
          └─▶ Collector  (어댑터별, 격리 실행)      §4 · §5
                 └─▶ Validator  (본문 검증)         §7
                        └─▶ Normalizer              §9
                               └─▶ Deduper          §9
                                      └─▶ Store     §2 · §10
                                            ├─▶ Notifier  (v0.5+)  §11
                                            └─▶ Web       (v0)
```

**v0에 존재하는 것은 `Store` + `Web`이다.** Notifier는 v0.5 이후.
파이프라인 형태는 처음부터 이대로 두고 나중에 붙이기만 한다.
실행 방식(Cloud Scheduler → Cloud Run Job)은 [[tech-stack]] §2.2.

---

## 1. 3계층 모델

```
mention   소스에서 온 원문 관측 (불변, 감사 추적)
   ↓ 정규화
item      굿즈 1개
   ↓ 묶음
drop      발표 단위 = 유저가 보는 단위 = 알림 단위
```

`drop`이 알림·화면의 단위다. 굿즈 20종을 알림 20개로 보내면 스팸이다.

---

## 2. 엔티티

### 2.1 source — 소스 레지스트리

| 필드 | 설명 |
| --- | --- |
| `id` / `name` | 식별자 |
| `kind` | `official_store` `fan_blog` `press` `konbini` `prize` `gacha` `apparel` `retail` |
| `fetch_kind` | `json` `rss` `atom` `html` `sitemap` |
| `interval` | 폴링 주기 |
| `crawl_delay` | robots 준수값 |
| `enabled` | 킬 스위치 |
| `last_success_at` | 헬스 모니터링 기준 (§10) |

### 2.2 mention — 원문 관측

**절대 수정하지 않는다.** 파서 회귀 검증의 유일한 자산이다.

`source_id` / `external_id` / `url` / `raw_title` / `raw_payload` / `observed_at`

### 2.3 item — 정규화된 굿즈

`drop_id` / `title` / `price` / `channel` / `status` /
`preorder_at` / `release_at` / `restock_at` / `official_url` / `image_url`

`image_url`은 **원본 링크만** 저장한다. 파일을 가져오지 않는다.

### 2.4 drop — 발표 단위

`title` / `kind` / `primary_date` / `status` (하위 `item` 집계)

### 2.5 status_history — 상태 전이 이력

append-only. `item_id` / `status` / `observed_at` / `source_mention_id`

> [!important] **v0 첫 커밋에 반드시 들어간다**
> 나중에 추가하면 **그 전에 일어난 전이는 소급 불가**다. 재수집으로 채울 수 없다.
> 관측 시점에 기록하지 않으면 영구히 없는 데이터다.
> v0에는 알림이 없지만 `status_history`는 v0부터 쌓는다 — 알림 정책을 실측으로 정하기 위한 유일한 근거다.

> [!warning] 같은 상태 재진입을 허용한다
> `(item_id, status)`에 unique를 걸면 안 된다.
> 재입고↔품절이 반복되므로 `ENDED → ON_SALE → ENDED → ON_SALE`이 정상 이력이다.

### 2.6 merge_override — 수동 교정

두 `item` 병합 / 병합 해제 / 특정 `mention` 무시. (§9.3)

---

## 3. 상태 판정

### 3.1 상태와 전이는 다른 층이다

```
상태(state)   UPCOMING / ON_SALE / ENDED    ← 지금 무엇인가.  item.status
전이(event)   status_history 연속 2행        ← 무슨 일이 났나.  알림 트리거
```

### 3.2 판정 규칙

> [!important] `available` 단독으로는 판정 불가
> **예약 개시 전과 매진 후가 둘 다 `available: false`다.**
> `販売開始前` 태그와 `available`을 **반드시 함께** 본다.

| 상태 | `販売開始前` 태그 | `available` |
| --- | --- | --- |
| `UPCOMING` | 있음 | `false` |
| `ON_SALE` | 없음 | **`true`** |
| `ENDED` | 없음 | `false` |

### 3.3 전이

| 전이 | 의미 |
| --- | --- |
| `∅ → UPCOMING` | 예약 컬렉션 신규 등장 |
| `UPCOMING → ON_SALE` | 예약/발매 개시 |
| `ON_SALE → ENDED` | 매진 / 종료 |
| `ENDED → ON_SALE` | **재입고** |

> [!warning] `RESTOCK`은 상태가 아니다
> 재입고 후의 상태는 `ON_SALE`이다. 상태 축에 두면 재입고↔품절 반복을 표현할 수 없다.
> `re*` 컬렉션은 이 전이의 힌트일 뿐 판정 근거가 아니다.

### 3.4 개시 시각

사이트에 텍스트로 존재하지 않는다. 실측 히스토그램(독립 2회 조사 일치):

- **발매 11:00 JST** / **예약 18:00 JST** (예외 존재)

→ **날짜만 신뢰**하고 시각은 "추정"으로 표기한다. 당일 폴링을 조여 실제 전이를 포착 (§6).

---

## 4. 어댑터 계약

모든 소스가 동일 인터페이스를 만족한다. **소스 추가 비용 = 파일 1개.**

| 항목 | 규약 |
| --- | --- |
| 입력 | `since` (마지막 성공 시각) |
| 출력 | `mention[]` |
| 멱등성 | 같은 입력 → 같은 `external_id` |
| 실패 격리 | 예외를 삼키지 않고 소스 단위로 격리. **1개 실패가 전체를 막지 않음** |
| 검증 | **본문 검증 필수** (§7) |
| 부하 | **동시 요청 1**, `crawl_delay` 준수 |

NestJS provider 1개 = 어댑터 1개. 실행 진입점은 `nest-commander` 커맨드 ([[tech-stack]] §2.3).

### 4.1 요청 규범

허용 범위의 근거는 **`chiikawamarket.jp/agents.md`** 다 — 공식 스토어가 문서로 명시한다.
**상품명·가격의 안내 목적 참조는 허용, 가격 비교·전매 목적 수집과 이미지·설명문 전재는 금지.**
[[plan-draft]] §1.4 비목표 전체가 이 문서에 근거한다.


- User-Agent: `chiikawa-goods-bot/0.1 (+https://github.com/gmldnjs26/chiikawa-goods)`
- `robots.txt` 파싱 후 준수, `Crawl-delay` 존중
- 원문 전재 금지 — **제목 · 가격 · 날짜 · 링크만** 저장
- 차단 신호(403 / 429 / 챌린지) 수신 시 해당 소스 자동 `enabled=false` + 알림

**로컬 개발 시에도 동일하다.** 대상 서버 입장에서 개발 요청과 프로덕션 요청은 구별되지 않는다.
가능하면 저장된 `raw_payload` 픽스처로 파서를 개발한다.

---

## 5. 소스 취득 경로

### Tier 0 — v0

| 소스 | 취득 경로 |
| --- | --- |
| 공식 스토어 ×2 (`chiikawamarket` / `nagano-market`) | `sitemap_collections_1.xml` → `/collections/pre*/products.json` |

**v0의 어댑터는 이 2개뿐이다.** 예약 사전 감지는 공식 스토어에만 존재한다.

컬렉션 명명 규칙이 리드타임 분류와 직결된다.

| 유형 | 컬렉션 패턴 | 사전 예고 |
| --- | --- | --- |
| 예약 | `pre*` | median 3일 / 최대 20일 |
| 발매 | `YYYYMMDD` | 3일 전 (**내용은 비어 있음**) |
| 재입고 | `re*` | **0일** |

### Tier 1 — v1

PR TIMES 키워드 JSON · `chiikawa.jp`(WP REST) · 세븐(RSS) · 로손(SSR) · 파미마(SSR) ·
반다이 캔디 · GiGO · キタンクラブ · アニメイト · UNIQLO API · `chiikawapark.com` · hateblo(시각 보완)

### Tier 2 — v1.5

반다이남코 AM · 타이토(`Crawl-delay: 20`) · キャラホビ · 프리미엄반다이(sitemap diff) ·
ちいかわベーカリー(`Crawl-delay: 10`) · ガシャポン

### Tier 3 — 보류

一番くじ(정책 차단) · 실점포 X API · 반자동 수동 입력

### 접근 금지 소스

| 소스 | 사유 |
| --- | --- |
| `1kuji.com`, `furyuprize.com`, `ota-goods.info`, 講談社 | `ClaudeBot` · `GPTBot` 전면 차단 |
| `chiikawa-info.jp` | Cloudflare 챌린지. **우회 가능하나 사용 금지** |

---

## 6. 스케줄

| 주기 | 대상 | 근거 |
| --- | --- | --- |
| **일 1회** | PR TIMES, 편의점 3사, 팬 블로그, 가챠/의류 | 하루 1~2건 |
| **30분** | 공식 스토어 sitemap + preorder | 신규 `pre*` 검출 |
| **1분 (한정 구간)** | 예약일 당일 `10:50~11:10` / `17:50~18:10` **JST** | 실측 피크 시각 (§3.4) |

- Cloud Scheduler의 `time_zone`을 `Asia/Tokyo`로 두고 **JST 그대로** 쓴다. UTC 환산 불필요
- 스케줄 정의는 Terraform에 있다. 코드에 두지 않는다 ([[tech-stack]] §2.2)
- 상시 1분 폴링은 하지 않는다. 제약은 비용이 아니라 **상대 서버 부하**다

> [!important] 착수 전 검증
> Cloud Scheduler가 `50-59 10 * * *` 형태의 분 범위를 받는지 확인.
> 호스팅 선정 근거가 여기 걸려 있다 ([[tech-stack]] §4).

---

## 7. 본문 검증 — 필수 공통 레이어

관측된 소프트 404 사례:

- `Content-Type: application/xml`인데 본문이 HTML (`/index.xml`)
- 404 응답인데 `application/xml` (`/feed.xml`)
- **없는 경로에도 200 + 공통 SPA** (`anime-chiikawa.jp`, 79,321 B, `<title>フジテレビ</title>`)

**규칙: 상태 코드를 신뢰하지 않는다.**

| 형식 | 검증 |
| --- | --- |
| 피드 | 선두 바이트 `<?xml` / `<rss` / `<feed` 스니핑 |
| JSON | 선두 바이트 `{` / `[` + 기대 키 존재 |
| HTML | 기대 셀렉터 존재 확인 |

검증 실패는 **파싱 성공이 아니라 수집 실패**로 기록한다.

---

## 8. 유실 방지 (짧은 윈도우 소스)

| 소스 | 윈도우 | 대응 |
| --- | --- | --- |
| `collections/all.atom` | 25건이 **7초**에 참 | **단독 사용 금지.** sitemap + JSON 병행 |
| PR TIMES 전사 RSS | 3~4시간 | 사용하지 않음. **키워드 JSON** 사용 |
| 파미마 상품 상세 | 종료 시 **404로 삭제** | 리스팅 폴링으로 사라지기 전 확보 |

---

## 9. 정규화 · 중복 제거

### 9.1 왜 어려운가

같은 一番くじ가 `1kuji` · PR TIMES · 팬 블로그에 **서로 다른 제목**으로 뜬다.
**굿즈 1개당 1행**을 만들지 못하면 소스를 늘릴수록 화면이 나빠진다. 수집 확대의 전제 조건이다.

### 9.2 3단계

| 단계 | 방법 | 커버 |
| --- | --- | --- |
| 1 | canonical URL 일치 | 대부분 |
| 2 | 정규화 제목 + 날짜 ±3일 유사도 | 소스 간 표기 차이 |
| 3 | 수동 병합 테이블 | 나머지 |

**2단계 정규화 규칙**

- 全角 → 半角 변환, 공백 제거, 대소문자 통일
- `【】「」()[]` 및 접두어 `予約` `新作` `再入荷` `速報` `まとめ` 제거
- bigram Jaccard **≥ 0.6** — 임계값은 소스가 늘어난 뒤 실측 재조정

### 9.3 수동 교정을 처음부터 만든다

자동 병합만 두면 **틀린 병합을 고칠 방법이 없다.** 최소 기능 3개: 병합 / 병합 해제 / `mention` 무시.

### 9.4 dedupe 키

소스 고유 ID(`releaseId` 등)를 쓴다.

> **PR TIMES `dc:date`는 사용 금지.**
> RSS 표기와 본문 표기가 불일치한다 (관측: `08-22 15:10` vs `08-18 20:51`).

---

## 10. 보존 · 모니터링

### 10.1 보존

| 대상 | 보존 |
| --- | --- |
| `mention` 행 (제목·URL·날짜·메타) | **영구** — 감사 추적 |
| `mention.raw_payload` | **90일 후 삭제** (잠정) |
| 저장 조건 | **내용 해시 비교. 무변경이면 저장하지 않음** |

30분 폴링은 대부분 무변경이라 해시 비교만으로 대부분 줄어든다.
90일은 v0 운용 1개월 후 실측 증가율로 조정한다. 근거: [[tech-stack]] §2.7.

### 10.2 모니터링

| 항목 | 설계 |
| --- | --- |
| 소스 헬스 | 소스별 `last_success_at`. **N회 연속 실패 시 알림** |
| 무음 감지 | 특정 소스가 기대보다 오래 조용하면 경보. **조용한 실패가 최악** |
| 킬 스위치 | 소스 단위 `enabled` 플래그 |
| 스키마 변경 대비 | 비공개 API(PR TIMES `.data`)는 **폴백 선언 필수** → `topics/keywords/ちいかわ` |
| 파서 회귀 | `mention.raw_payload`를 픽스처로 사용 |

---

## 11. 알림 발송 규칙 (v0.5 이후)

> v0에는 알림이 없다(화면은 있다). 전이는 `status_history`에 쌓아 두기만 한다.
> 한 달치 이력으로 발송 빈도를 실측한 뒤 v0.5에서 붙인다.

| 트리거 | 시점 |
| --- | --- |
| `∅ → UPCOMING` | 즉시 (최대 20일 전) |
| D-1 | 전일 |
| `UPCOMING → ON_SALE` | 즉시 |
| `ENDED → ON_SALE` (재입고) | 즉시. **반복 발생** |

> [!warning] 중복 방지 키는 `(drop_id, trigger)`가 아니다
> 재입고는 같은 `drop`에서 여러 번 일어난다. `(drop_id, trigger)`에 unique를 걸면
> 2회차 재입고가 발화하지 않는다.
> → 발송 기록은 **`status_history.id` 기준**으로 남긴다 (전이 1건 = 발송 1건).

발송 단위는 `drop`이다. 하위 `item` 수만큼 보내지 않는다.

---

## 관련 문서

- [[plan-draft]] — 제품 기획 (왜)
- [[tech-stack]] — 기술 선정·ADR (무엇으로)
- [[치이카와 굿즈 알리미 소스 조사]] — 소스 실지조사 결과
