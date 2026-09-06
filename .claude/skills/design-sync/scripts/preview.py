#!/usr/bin/env python3
"""캔버스 HTML의 한 절만 헤드리스 Chrome으로 렌더한다.

사용:
  python3 preview.py <plan.html> <절 선택> <out.png> [--width 1300] [--height 2600]

절 선택: 절 마커의 앞부분(예: "5", "3a", "1b 홈") — `<!-- ═══ N  제목 ═══ -->` 주석 텍스트에 부분 일치.
Chrome이 없으면 wrap.html만 남긴다 — 브라우저로 열어 본다.
"""
from __future__ import annotations

import argparse
import re
import subprocess
from pathlib import Path

CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
WRAP = (
    '<!doctype html><meta charset="utf-8"><style>body{{margin:0;padding:40px;background:#ECEAE6;'
    'font-family:-apple-system,BlinkMacSystemFont,"Hiragino Sans","Noto Sans JP",sans-serif;'
    "-webkit-font-smoothing:antialiased}}a{{color:#7A5A2A}}</style>"
    '<section style="display:flex;gap:40px;align-items:flex-start;flex-wrap:wrap">{body}</section>'
)


def pick(html: str, key: str) -> str:
    markers = list(re.finditer(r"<!-- ═+ (.*?) ═+ -->", html))
    for i, m in enumerate(markers):
        if key.replace(" ", "") in m.group(1).replace(" ", ""):
            start = m.start()
            end = markers[i + 1].start() if i + 1 < len(markers) else html.rfind("</section>")
            return html[start:end].rsplit("</section>", 1)[0]
    raise SystemExit(f"절을 못 찾았다: {key!r}. 있는 절: {[m.group(1) for m in markers]}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("plan")
    p.add_argument("section")
    p.add_argument("out")
    p.add_argument("--width", type=int, default=1300)
    p.add_argument("--height", type=int, default=2600)
    a = p.parse_args()

    body = pick(Path(a.plan).read_text(encoding="utf-8"), a.section)
    wrap = Path(a.out).with_suffix(".html")
    wrap.write_text(WRAP.format(body=body), encoding="utf-8")
    if not CHROME.exists():
        print(f"Chrome 없음. {wrap} 를 브라우저로 열어 본다")
        return
    subprocess.run(
        [
            str(CHROME), "--headless=new", "--disable-gpu", "--hide-scrollbars",
            f"--window-size={a.width},{a.height}", f"--screenshot={a.out}", f"file://{wrap.resolve()}",
        ],
        check=False, capture_output=True,
    )
    print(f"png: {a.out}")


if __name__ == "__main__":
    main()
