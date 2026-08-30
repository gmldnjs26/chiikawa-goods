# ちいかわ 굿즈 알리미 — 소스 필드 매핑 명세

| 항목 | 내용 |
| --- | --- |
| 문서 상태 | **초안 (draft)** |
| 버전 | v0.1 |
| 독자 | 개발자 |
| 상위 문서 | [[data-collection-design]] (수집 설계) / [[db-schema]] (테이블) |
| 범위 | **소스 원문 → 우리 테이블**의 필드 단위 대응. v0 = Shopify 3소스 |
| 근거 | 2026-08-23 실지 확인 (`chiikawamarket.jp` / `nagano-market.jp` / `chiikawamogumogu.shop`) |

---

## 0. 원칙

1. **파싱은 2단계다.** `원문 → mention`(가공 없음) → `mention → item`(해석). 두 단계를 섞지 않는다
2. **해석 규칙은 `source.config`에 둔다.** 코드에는 규칙을 읽는 로직만 둔다
3. **판정 못 한 값은 비워 둔다.** 추측으로 채우지 않는다
4. 같은 입력은 같은 `external_id`를 낸다 (멱등성)

---

## 1. Shopify → mention

취득: `/sitemap.xml`(인덱스) → 자식 sitemap → 각 컬렉션 `/collections/<handle>/products.json`

> [!warning] 자식 sitemap URL을 하드코딩하면 안 된다
> `chiikawamogumogu.shop/sitemap_collections_1.xml`은 **HTTP 400**이다.
> 실제 URL에 쿼리 파라미터가 붙어 있다 —
> `sitemap_collections_1.xml?from=474185662785&to=658000019777`
> `from`/`to` 값은 스토어마다 다르고 변한다.
> **반드시 `/sitemap.xml` 인덱스를 먼저 읽고 그 안의 URL을 그대로 쓴다.**

> [!warning] sitemap 인덱스에 **로케일 변종**이 섞여 있다 (실측 2026-08-29)
> `chiikawamarket.jp/sitemap.xml`의 자식이 **66개**인데, 그중 상당수가
> `/ko/sitemap_collections_1.xml` `/zh-hans/...` `/zh-hant/...`처럼 언어별 사본이다.
> 문자열에 `sitemap_collections`가 들어간 것을 전부 쓰면 **같은 상품을 언어 수만큼 본다.**
> → 경로가 `/sitemap_collections`로 **바로 시작하는 것만** 쓴다 (로케일 접두어 없음).
> 자식 수: `chiikawamarket.jp` 66 / `nagano-market.jp` 31 / `chiikawamogumogu.shop` 5.

> [!warning] `products.json`은 **250건이 한 페이지 상한**이다 (실측 2026-08-29)
> `?limit=250`으로 요청해도 250건이 오면 그건 "끝"이 아니라 **"다음 페이지가 있다"**이다.
> `?page=2`로 이어 받고, `products`가 **빈 배열이면 종료**한다 (`page=99` → 0건 확인).
> 250건에서 멈추면 200 + 정상 JSON이라 §7 본문 검증도 통과한다 —
> **조용한 누락이라 가장 위험하다.**

> [!note] 3곳 모두 `robots.txt`에 `Crawl-delay`가 없다 (실측 2026-08-29)
> 없다고 빨리 때려도 된다는 뜻이 아니다. 우리 하한(1초)과 `source.crawl_delay_sec`의
> max를 쓴다. 채집 시 실사용값은 3초였다.

| mention 컬럼 | 원문 | 비고 |
| --- | --- | --- |
| `external_id` | `product.id` (숫자) | **`handle`이 아니다.** handle은 변경될 수 있다 |
| `url` | `{base_url}/products/{handle}` | |
| `raw_title` | `product.title` | 가공 없음 |
| `raw_payload` | product 객체에서 **선별한 필드만** | 아래 화이트리스트. 컬렉션 소속을 `_collections: [handle]`로 덧붙인다 |
| `payload_hash` | `raw_payload` 정규화 후 SHA-256 | 키 순서 고정 필요 |
| `observed_at` | 수집 시각 | |

> [!warning] 같은 상품이 여러 컬렉션에 속한다
> `20260821`(발매)과 `20260821-release-sale`(발매＆세일)에 동시에 들어 있는 사례가 있다.
> 컬렉션마다 mention을 만들면 **같은 상품이 중복된다.**
> → **상품 단위로 1건**으로 합치고, 소속 컬렉션 전부를 `_collections` 배열에 넣는다.

> [!important] `raw_payload`는 **원문 전체가 아니다** (결정 2026-08-29)
> 「product 객체 전체」로 적혀 있었지만 [[data-collection-design]] §4.1은
> **제목 · 가격 · 날짜 · 링크만** 저장하라고 한다. 둘이 어긋나면 **좁은 쪽이 이긴다** —
> `body_html`(상품 설명문 전문)과 `images`는 저작물이고, 그걸 DB에 쌓는 것은 전재다.
> `UNIQUE(source_id, external_id, payload_hash)` 때문에 설명문이 한 글자 고쳐질 때마다
> 전문이 든 행이 하나 더 쌓인다는 점에서 더 나쁘다.
>
> 남기는 필드 (판정에 실제로 쓰는 것만):
> `id` `handle` `title` `published_at` `created_at` `updated_at` `vendor` `product_type` `tags`
> `variants[].{id, sku, price, available, taxable, title}` `_collections`
>
> 픽스처 채집 스크립트가 이미 같은 목록으로 걸러내고 있었다. 수집 경로에도 같은 것을 쓴다 —
> **한 곳에 정의하고 양쪽이 그걸 참조한다.**

> [!warning] `updated_at`은 **요청할 때마다 바뀐다** (실측 2026-08-29)
> 49초 간격으로 두 번 수집했더니 622건 전부 새 행이 됐다. 유일한 차이가
> `updated_at`(`17:53:45` → `17:54:34`)과 `variants[].updated_at`이었다.
> 상품 내용은 하나도 안 바뀌었다 — 재고 동기화 같은 내부 갱신이 그대로 나온다.
>
> **처음 설계("제외 필드 없음. `updated_at`도 관측이다")는 실측으로 뒤집혔다.**
> 그대로 두면 1시간 폴링이 하루에 같은 상품을 24번 적재한다. 해시 비교가 무의미해지고
> `disk_autoresize`가 늘어난다 — 한 번 늘면 줄지 않는다 ([[tech-stack]] §4.2).
>
> → `config.hash_exclude`에 **키 이름**을 넣는다. 중첩된 곳도 **깊이 무관하게** 뺀다
> (`variants[].updated_at`이 같은 이름이다). 기본값은 `["updated_at"]`.
>
> 대가: `updated_at`만 바뀐 갱신은 못 본다. 그건 애초에 우리가 볼 수 있는 변화가 아니었다.
> `raw_payload`에는 **원문 그대로** 저장한다 — 빼는 것은 해시 입력뿐이다.

---

## 2. mention → item

| item 컬럼 | 원문 | 규칙 |
| --- | --- | --- |
| `title` | `product.title` | 그대로 |
| `title_norm` | `product.title` | 全角→半角, 공백 제거, 접두어 제거 ([[data-collection-design]] §9.2) |
| `canonical_url` | `{base_url}/products/{handle}` | 소스 간 동일 판정 1순위 |
| `official_url` | 동일 | |
| `image_url` | `product.images[0].src` | **링크만.** 파일은 가져오지 않는다 |
| `price` | `min(variants[].price)` | §2.1 |
| `price_tax_included` | `true` (고정) | 표시가 `税込` 확인됨. `config.tax_included`로 소스별 지정 |
| `category` | `product.product_type` | `Tシャツ・パーカー` 등. 원문 유지 |
| `vendor` | `product.vendor` | `グレイ・パーカー・サービス` `株式会社寺子屋` |
| `channel` | `source.channel` | 소스에서 파생 |
| `acquisition` | `fixed` | Shopify 스토어는 확정 구매. `config`로 지정 |
| `series_total` | 제목의 `（全N種）` | 없으면 `NULL` |
| `region` | `online` | `config` 기본값 |
| `brand_id` | 태그·컬렉션 매칭 | §4 |
| `status` | 태그 + `available` | §3 |
| `preorder_on` / `release_on` | 태그 | §3.2 |
| `drop_id` | 컬렉션 | §5 |

### 2.1 variant를 어떻게 다루나 — 설계 구멍이었다

Shopify 상품은 variant(사이즈·색)를 갖는다. 실물에서 **`M: available=false` / `L: available=false`** 처럼
variant별로 판정이 갈린다. 우리 `item`은 상품 1개 = 카드 1장이므로 여기서 어긋난다.

**결정: `item` = Shopify product 1개.** variant로 쪼개지 않는다.

| 항목 | 규칙 |
| --- | --- |
| `status` | **variant 중 하나라도 `available=true`면 `ON_SALE`** |
| `price` | `min(variants[].price)` |
| `price_varies` | variant 간 가격이 다르면 `true` (신규 컬럼) |
| `variant_available` / `variant_total` | 재고 있는 variant 수 / 전체 수 (신규 컬럼) |

이유 — 카드 1장이 굿즈 1개라는 화면 규약([[plan]] §6.3)을 깨지 않는다.
사이즈별 재고는 **공식 페이지에 가면 정확히 나온다.** 우리가 중복해서 들고 있으면 어긋난다.

> [!note] 대신 "일부 품절"을 표시할 수 있다
> `variant_available < variant_total`이면 카드에 `一部品切れ`를 낸다.
> 사이즈 단위로 알림을 보내지는 않는다 — 그건 스팸이다.

---

## 3. 태그 → 날짜 · 상태 · 예정

### 3.1 태그 형식이 소스마다 다르다

| 소스 | 발매 | 예약 | 재입고 | 개시 전 |
| --- | --- | --- | --- | --- |
| `chiikawamarket.jp` | `20260821` | `PRE20260312` | `RE20260415` | `販売開始前` |
| `nagano-market.jp` | 동일 | `PRE20260826` (+`予約`) | `RE20260807` **및 `RE230302`(6자리 변종)** | `販売開始前` |
| `chiikawamogumogu.shop` | `2026年8月7日発売商品` | **없음** | **없음** | **없음** |

> [!important] もぐもぐ本舗에는 예약·재입고 태그가 존재하지 않는다 (확인 2026-08-23)
> 상품 30건의 태그 합집합에 `PRE` `RE` `予約` `再入荷` `販売開始前`이 **하나도 없었다.**
> 결과:
> - **예약 사전 감지가 이 소스에는 적용되지 않는다.** 차별점이 소스마다 다르다
> - **재입고 백필도 불가능하다.** 재입고는 `available` 전이를 실시간으로 잡는 것뿐
> - 상태 판정은 `available` 단독 (`販売開始前`이 없으므로 `UPCOMING`이 안 나온다)
>
> `config`의 예약·재입고 규칙을 `null`로 두고, 어댑터는 규칙이 없으면 그 판정을 건너뛴다.

**정규식을 코드에 두지 않는다.** `source.config`에 둔다 ([[db-schema]] §2).

> [!warning] 같은 태그 종류에 형식 변종이 있다
> `nagano-market.jp`에서 재입고 태그가 **두 형식으로 공존**한다 —
> `RE20260807`(8자리)과 **`RE230302`·`RE230622`(6자리, `YYMMDD`)**.
> 오래된 상품에 옛 형식이 남아 있다.
> → `config`의 태그 규칙은 **패턴 1개가 아니라 배열**이어야 한다.
> 6자리를 8자리로 해석하면 `2302년 3월 2일`같은 값이 나온다. 연도 2자리는 `20xx`로 보정한다.

> [!warning] 내부 운영 태그를 화면에 내지 않는다
> 관측된 것 — `在庫有無確認用タグ` `破棄対象商品` `ラッピング不可` `同梱不可A` `早インパラ`.
> `破棄対象商品`(폐기 대상)처럼 **운영 내부용이 섞여 있다.**
> `labels`에 태그를 그대로 넣으면 이런 게 카드에 뜬다.
> → `config.label_tags`에 **화이트리스트로 명시한 태그만** `labels`가 된다. 나머지는 버린다.

### 3.2 날짜 채우기

| 태그 | item 컬럼 |
| --- | --- |
| 발매 태그 | `release_on` |
| 예약 태그 | `preorder_on` |
| 재입고 태그 | §3.4 (백필) |

태그가 여러 개면 **가장 최근 것**을 쓰고, 나머지는 이력으로만 둔다.
`product.published_at`은 **참고값이다.** 태그 날짜와 어긋나면 태그를 우선하고 로그에 남긴다
(관측: `published_at 2026-08-21T11:01:23+09:00` ↔ 태그 `20260821` 일치).

### 3.3 상태 판정

```
販売開始前 태그 있음  AND  available=false   →  UPCOMING
販売開始前 태그 없음  AND  available=true    →  ON_SALE
販売開始前 태그 없음  AND  available=false   →  ENDED
販売開始前 태그 있음  AND  available=true    →  경보. UPCOMING으로 두고 사람이 본다
```

마지막 줄이 중요하다. **모순 조합은 조용히 한쪽으로 정하지 않는다.** 태그 체계 변경의 첫 징후다.

### 3.4 재입고 태그 백필

`RE20231221` `RE20260415`처럼 **과거 재입고가 누적**된다. 최초 수집 시 이걸 `status_history`로 되살린다.

| 생성 | 값 |
| --- | --- |
| `status_history` | 재입고 날짜마다 `ON_SALE` 1행 |
| `observed_at` | 태그 날짜 **00:00 JST** |
| `mention_id` | 백필 근거가 된 mention |

> [!warning] 백필 행에 표시를 남긴다
> 실시간 관측과 구별되어야 한다. `observed_at`이 00:00인 행은 **날짜만 아는 추정**이다.
> 개시 시각 통계(§3.5)를 낼 때 백필 행은 제외한다. 안 그러면 "재입고는 0시에 일어난다"는
> 틀린 실측치가 나온다. 구분 컬럼(`is_backfilled`)이 필요하다 — 신규 컬럼.

### 3.5 예정(scheduled_event) 생성

| 상황 | 생성 |
| --- | --- |
| `販売開始前` + 예약 태그 미래 날짜 | `kind=preorder`, `scheduled_on` |
| 발매 태그가 미래 날짜 | `kind=release`, `scheduled_on` |
| 상품 설명에 `再入荷予定` 문구 | `kind=restock`, `scheduled_on` 또는 `scheduled_text` |

세 번째는 **본문 파싱이 필요하고 형식이 정해져 있지 않다.** v0에서는 하지 않는다.
`9月下旬` 같은 표기는 `scheduled_text`에 원문 그대로 넣는다 ([[data-collection-design]] §3.3).

---

## 4. 브랜드 판정

```
1) product.tags 가 brand.match_rules.tags 와 일치       → brand_id
2) _collections 가 brand.match_rules.collections 와 일치 → brand_id
3) product.title 이 brand.match_rules.title_patterns 와 일치 → brand_id
4) 실패                                                  → NULL (화면에 その他)
```

`match_rules` 예:

```json
{ "tags": ["ちいかわレストラン"],
  "collections": ["chiikawababy", "chiikawababy_"],
  "title_patterns": ["^ちいかわ ちいかわレストラン"] }
```

**`vendor`를 브랜드로 쓰지 않는다.** `グレイ・パーカー・サービス`는 제조사다. 유저는 모른다.

---

## 5. 컬렉션 → drop_group

| drop_group 컬럼 | 값 |
| --- | --- |
| `grouping_key` | 컬렉션 handle (`20260821`) |
| `title` | 컬렉션 title (`8月21日発売商品`) |
| `kind` | 컬렉션 title에서 판정 (§5.1) |
| `primary_date` | handle의 날짜 부분 |

### 5.1 kind 판정은 title로 한다

> [!warning] 핸들 접두어를 믿으면 안 된다
> 실측: **`pre20250130`의 title이 `1月30日再入荷商品`** 이었다.
> 접두어와 내용이 어긋난 사례가 실재한다.

```
title 에 '予約'   → preorder
title 에 '再入荷' 또는 '再販' → restock
title 에 '発売'   → release
둘 이상 포함      → §5.2
```

### 5.2 혼합 컬렉션

`new-re20251219` = `12月19日発売＆再入荷商品`, `20260821-release-sale` = `8月21日発売＆セール商品`

**컬렉션 하나가 발표 하나가 아니다.** 이 경우 컬렉션으로 묶지 않고
`날짜 + 브랜드 + kind` 규칙으로 내려간다 ([[db-schema]] §6).
상품별 태그(`20260821` / `RE...`)가 개별 유형의 근거다.

### 5.3 컬렉션 핸들 형식이 스토어마다, 심지어 같은 스토어 안에서도 다르다

`chiikawamogumogu.shop` 실측 — 발매 컬렉션 핸들이 **한 스토어에서 4종 이상 혼재**한다.

| 핸들 | 제목 |
| --- | --- |
| `new2024-11-14` | `2024年11月14日　発売商品` |
| `new20250320` | `2025年3月20日　発売商品` |
| `new2026-2-13` | `2026年2月13日 発売商品` ← **0 패딩 없음** |
| `new2025-02-20` | `2月20日 発売商品` ← **제목에 연도 없음** |

> [!warning] 핸들에서 날짜를 파싱하지 않는다
> 형식이 4종이고 0 패딩도 일정하지 않다. 제목도 연도가 빠지는 경우가 있다.
> **`primary_date`는 소속 상품의 발매 태그에서 가져온다.** 컬렉션 핸들은 `grouping_key`로만 쓴다.
> 제목에서만 날짜를 얻어야 하는 경우, 연도가 없으면 컬렉션의 다른 근거(상품 태그)로 보정한다.

또 `new2025-10-17`과 `new2025-11-14`의 제목에 **전각 공백(`　`)** 이 섞여 있다.
제목 파싱 전에 전각 공백을 정규화한다.

### 5.4 중복 핸들

`pre20251024` / `pre20251024_`, `chiikawababy` / `chiikawababy_` — 접미 `_` 변종이 존재한다.
`grouping_key`는 **정규화한다**(말미 `_` 제거). 아니면 같은 발표가 둘로 갈린다.

---

## 6. source.config 스펙 (v0)

**`chiikawamarket.jp` / `nagano-market.jp`**

```json
{
  "release_tag":  "^(\\d{8})$",
  "preorder_tag": "^PRE(\\d{8})$",
  "restock_tag":  "^RE(\\d{8})$",
  "upcoming_tag": "販売開始前",
  "tax_included": true,
  "default_acquisition": "fixed",
  "default_region": "online",
  "supports_preorder_detection": true,
  "supports_restock_backfill": true
}
```

**`nagano-market.jp`** — 위와 같고, 아래를 더한다

```json
{
  "restock_tag": ["^RE(\\d{8})$", "^RE(\\d{6})$"],
  "relevance_filter": {
    "include_tags": ["ちいかわ", "ちいかわキャラクターズ"],
    "include_collections": ["chiikawa", "chiikawa-characters"],
    "mixed_marker_tags": ["ナガノのくま", "もぐらコロッケ", "パグ", "カエル", "ギョニソ"]
  },
  "label_tag_source": "character_table",
  "label_tags_extra": ["海外NG", "数量制限", "1個/1会計", "2個/1会計"],
  "drop_tags": ["在庫有無確認用タグ", "破棄対象商品", "同梱不可", "同梱不可A", "ラッピング不可", "キャンペーン対象外", "グループ", "共通商品", "新商品"]
}
```

`mixed_marker_tags`가 함께 있으면 `relevance='mixed'` + `他キャラ混在` 라벨을 낸다.

`label_tag_source: "character_table"` — 캐릭터 태그는 40종 이상이고 계속 늘어나므로
`config`에 나열하지 않고 **캐릭터 룩업 테이블**을 참조한다 (§9.1이 초기 시드).
미등록 태그가 나오면 **로그에 남기고 라벨은 비운다.** 라벨 누락은 안전한 실패다 —
오분류와 달리 화면에 틀린 정보가 나오지 않는다.

**`chiikawamogumogu.shop`**

```json
{
  "release_tag":  "^(\\d{4})年(\\d{1,2})月(\\d{1,2})日発売商品$",
  "preorder_tag": null,
  "restock_tag":  null,
  "upcoming_tag": null,
  "tax_included": true,
  "default_acquisition": "fixed",
  "default_region": "online",
  "supports_preorder_detection": false,
  "supports_restock_backfill": false,
  "label_tags": ["川越", "otaru", "kyoto-fusimi", "古本屋"]
}
```

**코드는 동일하다.** 규칙이 `null`이면 해당 판정을 건너뛴다.
`supports_*` 플래그는 무음 감지에 쓴다 — 예약 감지를 지원하지 않는 소스에
"예약이 안 잡힌다"는 경보를 내면 안 된다.

### 6.0 어느 컬렉션을 도는가 — `poll_collections`

> **결정 2026-08-29.** 실측에서 `chiikawamarket.jp`의 컬렉션이 **1006개**였다.
> 매 폴링마다 전부 도는 것은 불가능하고(1초 간격이면 17분), 상대에게도 무례하다.
> 그렇다고 핸들을 코드에 박으면 날짜 컬렉션이 새로 생길 때마다 배포해야 한다.

`sitemap`에서 컬렉션 핸들 전체를 받은 뒤, `config`가 고른 것만 `products.json`을 친다.

```json
{
  "poll_collections": {
    "always": ["newitems"],
    "date_pattern": "^(?:pre|re|new-re)?(\\d{8})",
    "recent_days": 14
  }
}
```

| 키 | 의미 |
| --- | --- |
| `always` | 매번 도는 핸들. 신상 유입구 |
| `date_pattern` | 날짜 컬렉션 판별 + 날짜 추출. **첫 캡처가 `YYYYMMDD`** |
| `recent_days` | 오늘 기준 **앞뒤** 일수. 예약 컬렉션은 미래 날짜다 |

앞뒤 양쪽인 이유 — `pre20260826`은 미래, `re20260820`은 과거다.
예약 사전 감지(차별점)가 미래 컬렉션에 걸려 있으므로 **미래를 잘라내면 제품이 죽는다.**

`date_pattern`이 없는 소스(`chiikawamogumogu.shop`는 날짜 컬렉션 자체가 다르다)는
`always`만 돈다. 규칙이 없으면 건너뛴다 — 여기서도 같다.

> [!note] 초기 전량 백필은 이 경로가 아니다
> 과거 상품 전체를 한 번 채우는 것은 별도 작업이다(폴링이 아니라 1회성).
> `recent_days`를 크게 잡아 대신하지 않는다 — 매 폴링마다 그 부하가 반복된다.

### 6.1 점포 한정 상품 — `region`이 아니다

もぐもぐ本舗에는 `川越店限定 扇子` 같은 상품이 있고, 컬렉션에 `kawagoe` `otaru` `kyoto-fusimi`가 있다.

> **점포 한정이지만 온라인에서 살 수 있다.** 지역 제약이 아니므로 `region`에 넣으면 틀린다.

→ **`item.labels`(신규)** 에 넣고 카드에 칩으로 낸다. 캐릭터 태그(`ハチワレ` `うさぎ`)도 같은 성격이다.
`region`은 **"내가 그 장소에 가야 하는가"** 일 때만 쓴다 (팝업·실점포 이벤트).

---

## 6.2 이용규약 확인 기록 (2026-08-29)

각 소스의 `/policies/terms-of-service`를 직접 읽고 관련 조항만 요약한다. 전문은 옮기지 않는다.

| 소스 | 상태 | 관련 조항 |
| --- | --- | --- |
| `chiikawamarket.jp` | 200 | 금지행위에 「사전 허가 없이 자동화 수단으로 상품을 구매 **그 외 본 사이트를 이용**하는 행위(**상품 페이지상의 정보 취득 등을 포함**)」. 지적재산권 조항은 사적 이용을 넘는 복제·반포·판매·공표 금지 |
| `nagano-market.jp` | 200 | 위와 **같은 문면** (같은 운영사) |
| `chiikawamogumogu.shop` | 200 | 「본 서비스로 얻은 정보를 **상업적으로 이용**하는 행위」 금지. 취득한 저작물의 복제·전재·배포·판매 금지. **자동화 수단 자체를 금지하는 조항은 없다** |

> [!important] 어긋나 보이는 이유 — **쓴 주체가 다르다** (확인 2026-08-29)
> `robots.txt`와 `agents.md`는 **Shopify가 플랫폼 차원에서 생성한 것**이다. 근거:
> `robots.txt`의 `Contact: bots@shopify.com`, `Terms of Service: shopify.com/legal/terms`,
> `agents.md`의 UCP/MCP 안내가 Shopify 표준 형식이다.
>
> 반면 `/policies/terms-of-service`는 **운영사(株式会社グレイ・パーカー・サービス)가
> 직접 쓴 이용규약**이고, 금지행위 목록도 거기에 있다.
>
> → 플랫폼이 기술적으로 열어 둔 것과 **운영사가 계약으로 금지한 것**은 층이 다르다.
> 우리가 지켜야 하는 쪽은 **운영사 규약**이다. 허가를 구할 상대도 Shopify가 아니라
> 운영사다. `nagano-market.jp`도 같은 운영사다 (`vendor`에 `グレイ・パーカー・サービス`).

> [!important] **결정 2026-08-29 — 만들고 나서 문의한다**
> 규약이 「**사전 허가 없이**」라고 적는다는 것은 **허가를 받으면 되는 길이 있다**는 뜻이다.
> 묻지 않고 하는 것이 위반이지, 하는 것 자체가 금지된 게 아니다.
>
> | 항목 | 결정 |
> | --- | --- |
> | 3소스 | **v0 개발 대상으로 유지한다.** Tier 3으로 내리지 않는다 |
> | 개발 방식 | 저장된 픽스처로 파서·화면을 만든다. 실사이트를 반복 호출하지 않는다 |
> | 라이브 수집 | **문의 전까지 켜지 않는다.** 시드가 `enabled=false`이고 `disabled_reason`이 이 절을 가리킨다 |
> | 문의 시점 | `fe/`가 픽스처로 돌아 **화면을 보여줄 수 있게 된 뒤** |
> | 문의 상대 | **株式会社グレイ・パーカー・サービス** (`chiikawamarket.jp` · `nagano-market.jp` 운영사). Shopify가 아니다 |
> | 폴링 주기 | **1시간.** 묻기 전에 부하부터 절반으로 줄인다 ([[data-collection-design]] §6) |
>
> 완성품이 있어야 물을 수 있는 게 아니다. 상대가 판단할 것은 **부하와 저작물 취급**이고
> 그건 지금 다 답할 수 있다 — 주기, 동시 요청 1, 저장 필드 화이트리스트,
> 이미지 미호스팅, 링크아웃, 무수익, 정지 수단. 화면은 「무엇을 만드는지」를 보이기 위한 것이다.
>
> 거절이나 침묵에 대비한 길: `chiikawamogumogu.shop`(다른 운영사, 자동화 금지 조항 없음) 단독,
> 또는 공식 SNS 등 공개 발신 소스로 축을 옮긴다. **침묵은 허가가 아니다.**

### 6.3 `/collections/<handle>/products.json`의 근거

Shopify **Ajax API 레퍼런스에 실린 경로가 아니다.** 스토어프론트가 공개로 여는 관행적 경로다.

- `robots.txt`에서 허용됨을 확인했다 (3소스, 2026-08-29)
- 인증·토큰이 필요 없고 로그인 뒤 화면이 아니다
- **「금지라고 안 써 있으니 해도 된다」로 두지 않는다** — 위 §6.2의 판단에 함께 걸린다

---

## 7. 관련성 필터 — `nagano-market.jp`

`nagano-market.jp`는 **ちいかわ 전용 스토어가 아니다.** 나가노의 다른 작품이 같은 피드에 섞인다.

관측된 캐릭터 태그 (상품 30건):

| 치이카와 계열 | 다른 작품 |
| --- | --- |
| `ちいかわ` `ちいかわキャラクターズ` `ハチワレ` `うさぎ` | `ナガノのくま` `もぐらコロッケ` `パグ` `カエル` `ギョニソ` |

컬렉션 규모로 보면 **치이카와가 소수다.**

| 컬렉션 | 상품 수 |
| --- | --- |
| `nagano-characters` (전체) | 1,458 |
| `kuma` (くま) | 905 |
| `chiikawa-characters` | 601 |
| `mogucoro` | 459 |
| `chiikawa` | 347 |
| `pug` | 292 |

**필터 없이 수집하면 화면의 절반 이상이 치이카와가 아닌 굿즈가 된다.**

### 7.1 판정 규칙

```
1) 태그에 'ちいかわ' 또는 'ちいかわキャラクターズ' 가 있으면        → relevance = included
2) 컬렉션이 chiikawa / chiikawa-characters 인데 1)이 아니면       → relevance = mixed  (수록 + 라벨)
3) 그 외                                                        → relevance = excluded
```

> [!warning] 컬렉션 소속은 **약한 근거**다 — 확인 결과 컬렉션이 순수하지 않다
> `nagano-market.jp/collections/chiikawa-characters`의 상품 태그 합집합에
> **`ナガノのくま` `パグ` `もぐらコロッケ` `BABYなくま` `ぽちゃねこむーたん`이 섞여 있다.**
> 즉 컬렉션 소속만으로 "치이카와 굿즈"라고 단정할 수 없다.
> → 컬렉션만 근거일 때는 `included`가 아니라 **`mixed`** 로 두고 라벨을 붙인다.

> [!important] 캐릭터 태그를 필터 근거로 쓰지 않는다
> 확인된 캐릭터 태그가 **40종 이상**이고 계속 늘어난다 (§9 부록).
> 게다가 나가노의 다른 작품 캐릭터와 한 스토어에서 섞인다.
> 화이트리스트로 유지하는 것이 불가능하다.
> **작품 단위 태그(`ちいかわ` / `ちいかわキャラクターズ`)만 필터 근거다.**
> 캐릭터 태그는 `labels`로만 쓴다 — 누락되면 칩이 안 나올 뿐, 오분류는 나지 않는다.

### 7.2 혼재 상품 — 럭키백 확인 결과

`【予約】ナガノキャラクターズ ハッピーバッグ2027（未年）` 전체 태그:

```
PRE20260826, 販売開始前, 予約, ナガノのくま, パグ, もぐらコロッケ,
トートバッグ, キャンペーン対象外, 同梱不可, 同梱不可A
```

**치이카와 태그가 없다.** 규칙대로 `excluded`가 된다 — 올바른 결과다.
`pre20260826` 컬렉션 안에 치이카와 럭키백은 없었다.

치이카와가 섞인 럭키백이 나오면 `ちいかわキャラクターズ`가 붙을 것으로 보이나 **아직 실물 확인은 못 했다.**
붙으면 `included`, 컬렉션만 걸리면 `mixed` + `他キャラ混在` 라벨이다.
치이카와만 들어있는 것처럼 보이면 유저가 잘못 산다.

### 7.3 제외된 것도 기록한다

> [!warning] 필터가 틀렸을 때 소급 복구가 되어야 한다
> 규칙이 잘못돼서 치이카와 상품을 제외하면, 그 발표는 **놓친 채로 끝난다**
> ([[data-collection-design]] §8 유실 방지 원칙).

| 처리 | 내용 |
| --- | --- |
| 제외 대상도 `mention`은 만든다 | `relevance='excluded'` (신규 컬럼) |
| `raw_payload`는 저장하지 않는다 | 용량. 제목·URL·태그만 남긴다 |
| `item`으로 승격하지 않는다 | 화면에 안 나온다 |
| 제외 건수를 `collection_run.excluded_count`에 남긴다 | 신규 컬럼 |

**제외 비율이 급변하면 경보를 낸다.** 평소 70% 제외인데 갑자기 99%면 태그 체계가 바뀐 것이다.
규칙을 고치고 **`relevance='excluded'` mention을 재처리**하면 복구된다.

### 7.4 다른 소스는 필터가 필요 없다

| 소스 | 필터 |
| --- | --- |
| `chiikawamarket.jp` | 불필요 (치이카와 전용) |
| `chiikawamogumogu.shop` | 불필요 |
| `nagano-market.jp` | **필수** |

`config.relevance_filter`가 없으면 전량 수록이다. 필터는 소스별 옵션이다.

---

## 8. 신규 컬럼 (본 문서에서 도출)

매핑을 쓰다 발견된 것들이다. [[db-schema]]에 반영한다.

| 테이블 | 컬럼 | 이유 |
| --- | --- | --- |
| `item` | `price_varies boolean` | variant 간 가격 차이 (§2.1) |
| `item` | `variant_available int` / `variant_total int` | `一部品切れ` 표시 |
| `status_history` | `is_backfilled boolean` | 태그 백필과 실시간 관측 구분 (§3.4) |
| `item` | `labels text[]` | 점포 한정·캐릭터 등 정보 라벨 (§6.1). `region`과 다르다 |
| `mention` | `relevance text` | `included` / `mixed` / `excluded` (§7.3) |
| `collection_run` | `excluded_count integer` | 필터 제외 건수. 급변 시 경보 (§7.3) |

---

## 9. 부록 — 관측된 태그 목록 (2026-08-23)

`config` 값을 짤 때의 근거다. **전량이 아니다** — 상품 250건 표본이다.

### 9.1 캐릭터 태그 (치이카와 세계관)

```
ちいかわ  ハチワレ  うさぎ  モモンガ  ラッコ  くりまんじゅう  シーサー  あのこ
鎧さん  ラーメンの鎧さん  古本屋  じいさん  フェアリーじいや  ナグリビト  マワシビト
きょりゅくん  もちきんちゃく  アザラシ  オデ  キョンシー  ゴブリン  チュパカブラ
ニセツチノコ  バイコーン  ユニコーン  キメラ  イッカク  ヒトデ  ネズミ  ゾウ
マレーグマ  キボシイワハイラックス  ツイバード  鳥の三兄弟  黒袋兄弟  ピエロ
星  黒い星  いちご  おにぎり  パン  兎  虎  鬼  ？（なぞのくま）  早インパラ
```

**40종을 넘고 계속 늘어난다.** 필터 근거로 쓸 수 없는 이유가 이것이다 (§7.1).

### 9.2 나가노의 다른 작품 캐릭터 (제외 대상 신호)

```
ナガノのくま  BABYなくま  もぐらコロッケ  いちごコロッケ  パグ  カエル  ギョニソ
ぽちゃねこむーたん
```

### 9.3 시리즈·콜라보 태그 → `brand` 초기 목록 후보

```
ちいかわレストラン       まじかるちいかわ        超まじかるちいかわ
Chiikawa Baby          Kiramekko              チルチルちいかわ
Go!HARAJUKU            Go!IKEBUKURO           パラレルワールド
シーサーのおみやげやさん   ちいかわ×サンリオキャラクターズ
CONVERSE×ちいかわ       ちいかわもぐもぐ本舗
```

`ちいかわ×サンリオキャラクターズ` 콜라보 상품에는 `ハローキティ` `シナモロール` `ポムポムプリン`
같은 **타사 IP 캐릭터 태그**가 붙는다. `labels`에 그대로 낸다 — 유저에게 유용한 정보다.

### 9.4 카테고리 태그 (→ `category` 보조)

```
アパレル  Tシャツ・パーカー  ぬいぐるみ  マスコット  ぬいぐるみ・マスコット
バッグ・ポーチ  トートバッグ  がま口・ポーチ・巾着  キーホルダー  文房具
キッチン  調理道具  インテリア  照明・加湿器  ファッション小物  タオル・てぬぐい
アクセサリー  マグネット  ピンバッジ  扇子  ステッカー
```

### 9.5 화면에 내지 않는 태그 (운영·구매제약)

```
数量制限  1個/1会計  2個/1会計  1サイズにつき1枚/1会計  海外NG
同梱不可  同梱不可A  ラッピング不可  キャンペーン対象外  グループ
在庫有無確認用タグ  破棄対象商品  新商品  予約  販売開始前  共通商品
```

일부는 **유저에게 유용하다** — `海外NG`(해외 배송 불가), `数量制限`(수량 제한),
`1個/1会計`(1인 1개). 이건 `labels`에 넣는다.
`在庫有無確認用タグ` `破棄対象商品`처럼 내부용은 **반드시 버린다.**

---

## 10. 미확인

| # | 항목 | 영향 |
| --- | --- | --- |
| 1 | `product.id`가 스토어 간 충돌하지 않는지 | `external_id`는 `source_id`와 복합키라 문제없음 |
| 2 | もぐもぐ本舗의 상품 수가 늘면 sitemap이 분할되는지 | `/sitemap.xml` 인덱스를 매번 읽으므로 자동 대응 |
| 3 | **치이카와**가 섞인 럭키백에 `ちいかわキャラクターズ`가 붙는지 | 실물 미출현. 안 붙으면 제목 매칭 보강 |
| 4 | `RE` 6자리 변종이 `PRE`·발매 태그에도 있는지 | 있으면 모든 태그 규칙을 배열로 |
| 5 | 캐릭터 태그 신규 추가 시 감지 방법 | 미등록 태그 발생을 로그로 남겨 수동 추가 |

**해소됨** — もぐもぐ本舗 태그 체계(예약·재입고 **없음**), sitemap 취득 방식(인덱스 필수),
컬렉션 핸들 형식(파싱 금지), 점포 한정 취급(`labels`),
`nagano-market.jp` 컬렉션 패턴(`chiikawamarket.jp`와 동일),
관련성 필터(§7), 캐릭터·시리즈·운영 태그 목록(§9),
나가노 럭키백 처리(치이카와 태그 없음 → `excluded`).
