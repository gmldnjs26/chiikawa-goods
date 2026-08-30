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
