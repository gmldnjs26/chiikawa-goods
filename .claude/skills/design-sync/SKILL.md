---
name: design-sync
description: Claude Design 프로젝트 「ちいかわグッズ タイムライン Design Plan」과 저장소를 동기화한다. 디자인 플랜을 읽어 코드와 diff하거나(읽기), 플랜에 절을 추가·수정해 올리거나(쓰기), 플랜 변경을 fe 코드에 반영할 때 쓴다. "디자인 플랜 읽어줘", "디자인 바뀐 거 반영해줘", "플랜에 ○○ 추가해서 올려줘", "디자인 동기화" 같은 요청이 트리거다.
---

# design-sync

디자인의 진실은 **Claude Design 프로젝트의 `Design Plan.dc.html`**(캔버스)이다. 저장소에는 그 **스냅샷**을 둔다 —
`docs/design-plan.dc.html`. 스냅샷은 「마지막으로 동기화한 상태」이고, diff의 기준이다.

| 항목 | 값 |
| --- | --- |
| projectId | `0ddc44c6-027f-4375-b0fc-d443473986a3` |
| 캔버스 파일 | `Design Plan.dc.html` — **이것만 읽고 쓴다** |
| 파생 파일 | `ちいかわグッズ タイムライン Design Plan.html`(번들) · `Design Plan standalone-src.html` · `support.js` · `.thumbnail` — Claude Design이 만든다. **건드리지 않는다** |
| 스냅샷 | `docs/design-plan.dc.html` (커밋 대상. 코드 반영과 같은 커밋에) |
| 의뢰서 · 이력 | `docs/design-brief.md` — 「결과」 행에 버전 이력 |
| 코드 쪽 요약 | `.claude/agents/frontend-dev.md` §디자인 |

도구는 **`DesignSync`**(MCP 아님, 내장). 인증이 안 돼 있으면 사용자에게 `/design-login`을 **`!` 없이** 입력해 달라고 한다.
`list_projects`는 디자인 시스템 타입만 보여서 이 프로젝트는 **빈 목록**으로 나온다 — 정상이다. `get_project`로 직접 간다.

---

## 1. 읽기 — 플랜이 바뀌었는지 보고 코드에 반영

```
1. DesignSync get_file  { projectId, path: "Design Plan.dc.html" }
   → 결과가 크면 persisted-output 파일 경로가 온다
2. python3 .claude/skills/design-sync/scripts/extract.py <persisted-output.txt 또는 -> <out.html>
   → out.html에 content를 풀고, 스냅샷과의 diff(태그 단위)와 절 목록을 출력한다
3. 바뀐 절만 python3 .claude/skills/design-sync/scripts/preview.py <out.html> <절 id 또는 마커> <png>
   → 헤드리스 Chrome으로 그 절만 렌더. Read로 본다
4. 변경점을 표로 정리해 사용자에게 보인다 (무엇이 · 어디서 · 어떤 값으로)
5. 코드 반영 → 스냅샷 갱신(cp out.html docs/design-plan.dc.html) → docs/design-brief.md 「결과」 행에 버전 · 날짜 · 한 줄
```

`extract.py`는 인수 없이 stdin도 받는다. persisted-output이 아니라 JSON 본문이 그대로 왔으면 파일로 저장해 넘긴다.

### 플랜 → 코드 매핑

| 플랜의 절 | fe 파일 |
| --- | --- |
| 1a 팔레트 · 타입 스케일 · 라운드 | `fe/src/app/globals.css` 토큰. 새 색은 토큰으로 추가, 컴포넌트에 hex 금지 |
| 1a 「정하라」 결정 · 뱃지 | `fe/src/modules/item/components/StatusBadge.tsx` (뱃지 8종 · `railClass`) |
| 1b · 2a 카드 | `fe/src/modules/item/components/ItemCard.tsx` · `CardImage.tsx` · `_common/components/Chip.tsx` |
| 1b 섹션 헤더 · 필터 | `_common/components/Section.tsx` · `item/components/FilterableSections.tsx` |
| 2b 전용 페이지 | `fe/src/app/[section]/page.tsx` · `app/home-sections.tsx` |
| 3a · 3b 캘린더 | `fe/src/modules/calendar/components/CalendarList.tsx` · `MonthNav.tsx` |
| 4a · 4b · 4c 아카이브 · 상태들 | `item/components/ArchiveList.tsx` · `app/not-found.tsx` · `app/error.tsx` |
| 5 테마 전환 | `_common/components/ThemeToggle.tsx` · `globals.css` view-transition 블록 · `app/layout.tsx` 인라인 스크립트 |
| 헤더 · 탭 | `app/layout.tsx` · `_common/components/NavTabs.tsx` |

인라인 스타일의 px 값은 Tailwind 유틸리티로 옮긴다 (72→`size-18`, 96→`size-24`, 6px 라운드→`rounded-md`, 8px→`rounded-lg`).
플랜의 hex는 토큰 이름으로 바꾼다 — 1a 팔레트 표가 사전이다.

---

## 2. 쓰기 — 플랜에 절을 추가하거나 고쳐서 올리기

```
1. 최신본을 먼저 받는다 (§1의 1~2). 스냅샷이 오래됐을 수 있다 — 사용자가 Claude Design에서 직접 고쳤을 수 있다
2. out.html을 편집한다. 새 절은 마지막 <section> 안 또는 </x-dc> 앞에 새 <section>으로
3. 1a의 버전 표기를 올린다 — `v1.2 · 2026-09-06 (…)` 형식. 무엇을 더했는지 괄호에
4. preview.py로 새 절을 렌더해 확인
5. DesignSync finalize_plan { projectId, writes: ["Design Plan.dc.html"], deletes: [], localDir: <out.html이 있는 디렉토리> }
   → planId
6. DesignSync write_files { projectId, planId, files: [{ path: "Design Plan.dc.html", localPath: "<out.html 파일명>", mimeType: "text/html" }] }
7. 스냅샷 갱신 + docs/design-brief.md 「결과」 행 + (코드 규약이 바뀌면) frontend-dev.md §디자인
```

`finalize_plan`은 `deletes`가 필수다 — 빈 배열을 넘긴다. `write_files`의 `localPath`는 `localDir` 기준 상대경로.

### 캔버스 문법 — 기존 절과 같게

- 절 = `<!-- ═══ N  제목 ═══ -->` 주석 + `<div id="Na">…</div>`(시안) + `<div id="Nb">…</div>`(규칙표)
- 시안 라벨: `<div style="position:absolute;top:-28px;left:0;font:600 11px/1 ui-monospace,…;color:#7A5A2A;border:1px solid #7A5A2A;padding:4px 6px;">Na · 제목 375 · 라이트</div>`
- 시안 프레임: `width:375px;background:#F4F2EE;color:#1C1A17;font-size:15px;line-height:1.5;` (다크는 `#1B1A18` / `#EDEAE4`)
- 규칙표: `width:400px;background:#FBFAF8;padding:40px 32px;` + `display:grid;grid-template-columns:110px 1fr;gap:8px 16px;`
- 색은 1a 팔레트의 hex만. 이모지 없음. 아이콘은 lucide SVG 인라인(stroke-width 2)
- 모든 스타일은 인라인. `<style>`을 새로 넣지 않는다 — Claude Design 캔버스가 그렇게 돼 있다

---

## 3. 하지 않는 것

- 파생 파일 4개를 쓰지 않는다. 캔버스만 고치면 Claude Design이 다시 만든다
- 스냅샷을 건너뛰고 코드만 고치지 않는다 — 다음 diff가 거짓말을 한다
- 플랜에 없는 시각 결정을 코드에서 먼저 하지 않는다. 먼저 플랜에 절을 추가해 올리고(§2), 그다음 코드
- `list_projects`가 비었다고 인증 실패로 판단하지 않는다 — `get_project`가 `canEdit: true`면 된다
