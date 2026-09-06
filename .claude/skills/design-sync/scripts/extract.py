#!/usr/bin/env python3
"""DesignSync get_file 결과에서 HTML을 꺼내고, 스냅샷과 diff하고, 절 목록을 찍는다.

사용:
  python3 extract.py <get_file 결과 파일 | -> <out.html> [--snapshot docs/design-plan.dc.html]

결과 파일은 persisted-output(.txt, JSON 본문)이거나 JSON 그대로다. `-`면 stdin.
"""
from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
DEFAULT_SNAPSHOT = REPO / "docs" / "design-plan.dc.html"


def load_content(source: str) -> str:
    raw = sys.stdin.read() if source == "-" else Path(source).read_text(encoding="utf-8")
    raw = raw.strip()
    if raw.startswith("{"):
        data = json.loads(raw)
        return data["content"] if "content" in data else raw
    return raw


def split_tags(html: str) -> list[str]:
    return re.sub(r">\s*<", ">\n<", html).split("\n")


def sections(html: str) -> list[str]:
    return re.findall(r"<!-- ═+ (.*?) ═+ -->", html)


def version(html: str) -> str | None:
    m = re.search(r"v\d+(?:\.\d+)? · 20\d\d-\d\d-\d\d[^<]*", html)
    return m.group(0) if m else None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("source")
    p.add_argument("out")
    p.add_argument("--snapshot", default=str(DEFAULT_SNAPSHOT))
    p.add_argument("--max-diff", type=int, default=80)
    a = p.parse_args()

    html = load_content(a.source)
    Path(a.out).write_text(html, encoding="utf-8")
    print(f"out: {a.out} ({len(html):,} bytes)")
    print(f"version: {version(html)}")
    print("sections:", " | ".join(sections(html)))

    snap = Path(a.snapshot)
    if not snap.exists():
        print(f"snapshot 없음: {snap} — 첫 동기화면 out을 스냅샷으로 복사한다")
        return
    old = snap.read_text(encoding="utf-8")
    if old == html:
        print("diff: 없음 — 스냅샷과 같다")
        return
    diff = [
        line
        for line in difflib.unified_diff(split_tags(old), split_tags(html), lineterm="", n=0)
        if line.startswith(("+", "-")) and not line.startswith(("+++", "---"))
    ]
    print(f"diff: {len(diff)}줄 (태그 단위, 앞 {a.max_diff}줄)")
    for line in diff[: a.max_diff]:
        print(line[:300])


if __name__ == "__main__":
    main()
