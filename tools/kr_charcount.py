#!/usr/bin/env python3
"""Count Korean application-answer characters and encoded bytes."""

from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from pathlib import Path


def force_utf8_output() -> None:
    """Keep CLI output UTF-8 even when stdout uses a legacy host encoding."""
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(encoding="utf-8")


def metrics(text: str, count_newlines: bool = False) -> dict[str, int | list[str] | None]:
    """Return counts after NFC normalization.

    Character counts use Python code points as a grapheme approximation; some
    combining-mark sequences can still count as multiple characters. The
    trimmed body is the common input for every metric. Newlines are excluded
    from all metrics by default, or counted as one character and their encoded
    bytes when ``count_newlines`` is enabled. CP949 is undefined if any
    character cannot be encoded; the byte count is then ``None`` and the
    unique unencodable characters are returned for display.
    """
    normalized = unicodedata.normalize("NFC", text).strip()
    if not count_newlines:
        counted = normalized.replace("\r\n", "").replace("\r", "").replace("\n", "")
    else:
        counted = normalized
    without_spaces = "".join(ch for ch in counted if ch not in " \t\r\n")
    unencodable = sorted({ch for ch in counted if not _is_cp949_encodable(ch)})
    cp949_bytes = len(counted.encode("cp949")) if not unencodable else None
    return {
        "with_spaces": len(counted),
        "without_spaces": len(without_spaces),
        "bytes_utf8": len(counted.encode("utf-8")),
        "bytes_cp949": cp949_bytes,
        "cp949_unencodable": unencodable,
    }


def _is_cp949_encodable(character: str) -> bool:
    try:
        character.encode("cp949")
    except UnicodeEncodeError:
        return False
    return True


def split_headings(text: str) -> list[tuple[str, str]]:
    """Split Markdown at level-two/three headings beginning with 문항 N."""
    import re

    sections: list[tuple[str, list[str]]] = []
    current_name = "본문"
    current_lines: list[str] = []
    pattern = re.compile(r"^#{2,3}\s+문항\s*\d+\b.*$")
    for line in text.splitlines(keepends=True):
        if pattern.match(line.rstrip("\r\n")):
            if current_lines or not sections:
                sections.append((current_name, current_lines))
            current_name = line.strip()
            current_lines = []
        else:
            current_lines.append(line)
    sections.append((current_name, current_lines))
    return [(name, "".join(lines).strip()) for name, lines in sections if lines or name != "본문"]


def render_table(rows: list[dict], limit: int | None, mode: str) -> str:
    output = []
    for row in rows:
        result = ""
        if limit is not None:
            value = row[mode]
            result = f" / 제한 {limit}: {'계산 불가' if value is None else ('초과' if value > limit else '통과')}"
        heading = f"[{row['heading']}] " if row.get("heading") else ""
        cp949 = f"{row['bytes_cp949']}바이트" if row["bytes_cp949"] is not None else "계산 불가"
        unencodable = ""
        if row["cp949_unencodable"]:
            chars = " ".join(f"U+{ord(ch):04X}({ch})" for ch in row["cp949_unencodable"])
            unencodable = f" / CP949 인코딩 불가 문자: {chars}"
        output.append(
            f"{heading}공백 포함 {row['with_spaces']}자 | 공백 제외 {row['without_spaces']}자"
            f" | UTF-8 {row['bytes_utf8']}바이트 | CP949 {cp949}{unencodable}{result}"
        )
    return "\n".join(output)


def main(argv: list[str] | None = None) -> int:
    force_utf8_output()
    parser = argparse.ArgumentParser(
        description="자기소개서 글자 수와 인코딩별 바이트를 계산합니다.",
        epilog="모든 지표는 앞뒤 공백을 제거한 동일 본문을 사용합니다. 기본은 개행을 모든 지표에서 제외하며, "
               "--count-newlines 사용 시 개행을 1자로 세고 UTF-8/CP949 바이트에도 포함합니다. "
               "CP949 불가 문자가 있으면 CP949 바이트는 계산 불가로 표시하고 해당 문자를 나열합니다.",
    )
    parser.add_argument("files", nargs="*", help="UTF-8 파일 경로 (생략하면 표준 입력)")
    parser.add_argument("--by-heading", action="store_true", help="문항 헤더(## 문항 N / ### 문항 N)별로 계산")
    parser.add_argument("--count-newlines", action="store_true", help="본문 내부 줄바꿈을 모든 지표에 포함")
    parser.add_argument("--limit", type=int, help="제한 수치")
    parser.add_argument("--mode", choices=("with-spaces", "without-spaces", "bytes-utf8", "bytes-cp949"), default="with-spaces")
    parser.add_argument("--format", choices=("json", "table"), default="table")
    args = parser.parse_args(argv)
    if args.limit is not None and args.limit < 0:
        parser.error("--limit은 0 이상이어야 합니다")
    try:
        sources = [(str(path), path.read_text(encoding="utf-8")) for path in map(Path, args.files)]
        if not sources:
            sources = [("stdin", sys.stdin.read())]
    except (OSError, UnicodeError) as exc:
        print(f"입력을 읽지 못했습니다: {exc}", file=sys.stderr)
        return 1
    mode = args.mode.replace("-", "_")
    rows: list[dict] = []
    for source, text in sources:
        units = split_headings(text) if args.by_heading else [("", text)]
        for heading, content in units:
            row = {"file": source, **metrics(content, args.count_newlines)}
            if heading:
                row["heading"] = heading
            if args.limit is not None:
                value = row[mode]
                row["exceeded"] = None if value is None else value > args.limit
            rows.append(row)
    if args.format == "json":
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        print(render_table(rows, args.limit, mode))
    return 2 if args.limit is not None and any(row.get("exceeded") is True for row in rows) else 0


if __name__ == "__main__":
    sys.exit(main())
