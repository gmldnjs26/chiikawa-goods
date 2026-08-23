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

취득: `sitemap_collections_1.xml` → 각 컬렉션 `/collections/<handle>/products.json`

| mention 컬럼 | 원문 | 비고 |
| --- | --- | --- |
| `external_id` | `product.id` (숫자) | **`handle`이 아니다.** handle은 변경될 수 있다 |
| `url` | `{base_url}/products/{handle}` | |
| `raw_title` | `product.title` | 가공 없음 |
| `raw_payload` | product 객체 전체 | 컬렉션 소속을 `_collections: [handle]`로 덧붙인다 |
| `payload_hash` | `raw_payload` 정규화 후 SHA-256 | 키 순서 고정 필요 |
| `observed_at` | 수집 시각 | |

> [!warning] 같은 상품이 여러 컬렉션에 속한다
> `20260821`(발매)과 `20260821-release-sale`(발매＆세일)에 동시에 들어 있는 사례가 있다.
> 컬렉션마다 mention을 만들면 **같은 상품이 중복된다.**
> → **상품 단위로 1건**으로 합치고, 소속 컬렉션 전부를 `_collections` 배열에 넣는다.

`payload_hash`에서 **제외**할 필드: 없음. Shopify `updated_at`도 포함한다 —
내용이 같고 `updated_at`만 바뀌면 새 행이 생기지만, 그것도 "상대가 무언가 갱신했다"는 관측이다.
단 노이즈가 심하면 `config.hash_exclude`로 뺀다.

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

이유 — 카드 1장이 굿즈 1개라는 화면 규약([[plan-draft]] §6.3)을 깨지 않는다.
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
| `nagano-market.jp` | 동일 | `PRE20260826` (+`予約`) | 동일 | `販売開始前` |
| `chiikawamogumogu.shop` | `2026年8月7日発売商品` | 미확인 | 미확인 | 미확인 |

**정규식을 코드에 두지 않는다.** `source.config`에 둔다 ([[db-schema]] §2).

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

### 5.3 중복 핸들

`pre20251024` / `pre20251024_`, `chiikawababy` / `chiikawababy_` — 접미 `_` 변종이 존재한다.
`grouping_key`는 **정규화한다**(말미 `_` 제거). 아니면 같은 발표가 둘로 갈린다.

---

## 6. source.config 스펙 (v0)

```json
{
  "release_tag":  "^(\\d{8})$",
  "preorder_tag": "^PRE(\\d{8})$",
  "restock_tag":  "^RE(\\d{8})$",
  "upcoming_tag": "販売開始前",
  "date_format":  "YYYYMMDD",
  "tax_included": true,
  "default_acquisition": "fixed",
  "default_region": "online",
  "collection_sitemap": "/sitemap_collections_1.xml"
}
```

`chiikawamogumogu.shop`은 `release_tag`가 `^(\\d{4})年(\\d{1,2})月(\\d{1,2})日発売商品$`,
`date_format`이 `YYYY年M月D日`다. **코드는 동일하다.**

---

## 7. 신규 컬럼 (본 문서에서 도출)

매핑을 쓰다 발견된 것들이다. [[db-schema]]에 반영한다.

| 테이블 | 컬럼 | 이유 |
| --- | --- | --- |
| `item` | `price_varies boolean` | variant 간 가격 차이 (§2.1) |
| `item` | `variant_available int` / `variant_total int` | `一部品切れ` 표시 |
| `status_history` | `is_backfilled boolean` | 태그 백필과 실시간 관측 구분 (§3.4) |

---

## 8. 미확인

| # | 항목 | 영향 |
| --- | --- | --- |
| 1 | `chiikawamogumogu.shop`의 예약·재입고 태그 형식 | `config` 값 확정 불가. 어댑터 코드는 무영향 |
| 2 | `販売開始前` 태그가 세 소스 모두 동일한지 | 다르면 `config.upcoming_tag`로 흡수 |
| 3 | `product.id`가 스토어 간 충돌하지 않는지 | `external_id`는 `source_id`와 복합키라 문제없음 |
| 4 | 컬렉션 sitemap이 여러 페이지로 나뉘는 경우 | `sitemap_collections_2.xml` 존재 여부 확인 |
