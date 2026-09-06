# 픽스처

`scripts/capture-fixtures.ts`로 채집한 **실측 원문**이다 (2026-08-29).
파서는 이걸로 개발한다 — 개발 중에 실제 사이트를 반복 호출하지 않는다
(docs/data-collection-design.md §4.1).

## 손을 댄 부분

저장소가 **public**이라 원문을 그대로 두지 않는다 (원문 전재 금지, plan.md §1.4).

| 파일 | 가공 |
| --- | --- |
| `products-*.json` | 앞 8건만. `body_html` · `images` 제거, 파서가 읽는 필드만 남김 |
| `sitemap_collections.xml` | 앞 50개 `<url>`만 |
| `sitemap.xml` | 그대로 (자식 sitemap 목록. 로케일 변종 확인용) |

**건수는 실제와 다르다.** "몇 건이 오는가"를 이 파일로 판정하면 안 된다 —
실제 `products.json`은 `limit=250`에서 잘린다 (docs/source-mapping.md §1).

## `live/` — 라이브 수집 원문 (gitignore)

`live/<source>-<YYYYMMDD>.json` 은 `mention.raw_payload`를 그대로 덤프한 것이다
(`{ source, capturedAt, products: [...] }`). 건수 · 필드 전부 실제다. **커밋하지 않는다** — 저장소가 public이라
전문 전재가 된다. 로컬에만 두고 이슈 해결(브랜드 매칭 실측 등)에 쓴다.

| 파일 | 건수 | 비고 |
| --- | --- | --- |
| `chiikawamarket-20260906.json` | 705 | 2026-09-06 1회 라이브 수집 (docs/source-mapping.md §6.2 기록) |
| `chiikawamogumogu-20260906.json` | 606 | 2026-08-30 수집분 (9/6 재수집은 주기 게이트로 skip) |

다시 뽑기:

```sh
docker exec chiikawa-postgres psql -U chiikawa -d chiikawa -Atc \
  "select jsonb_build_object('source','chiikawamarket','capturedAt',max(observed_at),'products',jsonb_agg(raw_payload order by id)) \
   from mention where source_id=(select id from source where code='chiikawamarket')" > be/test/fixtures/live/chiikawamarket-YYYYMMDD.json
```

`raw_payload`는 90일 후 purge 대상이다 (docs/data-collection-design.md §10.1). 덤프가 보험이다.
