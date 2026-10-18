#!/usr/bin/env python3
"""Lint Korean job application answers for common instruction violations."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from tools.kr_charcount import is_note_section, split_headings
except ModuleNotFoundError:  # Direct ``python tools/kr_application_lint.py`` execution.
    from kr_charcount import is_note_section, split_headings


def force_utf8_output() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(encoding="utf-8")


def sentences(text: str) -> list[str]:
    text = re.sub(r"\s*\n+\s*", " ", text.strip())
    return [part.strip() for part in re.split(r"(?<=[.!?。！？])\s+", text) if part.strip()]


def _terms(text: str) -> set[str]:
    # Korean/English content words of at least two characters; ignore particles.
    words = re.findall(r"[가-힣]{2,}|[A-Za-z][A-Za-z0-9+#.]{1,}", text)
    particles = ("에서", "으로", "에게", "하고", "하며", "되어", "하는", "했다", "입니다", "습니다", "그리고", "하지만", "통해")
    return {w for w in words if w not in particles}


ASPIRATION = re.compile(r"겠습니다|싶습니다|하겠다|노력하|기여하고자|성장하|익혀\s*가겠|키우겠|배우겠")
ANALYSIS = re.compile(r"에 해당하는|공고의.{0,40}(?:요구|우대|자격|업무|개발)|요구사항|대조|충족|미충족")
SELF_DISQUALIFY = re.compile(r"경험은 없|경험이 없|없습니다만|부족하지만")
PLACEHOLDER = re.compile(r"\[[^\]]*\]|\bTODO\b|\[YOUR_[^\]]*\]", re.IGNORECASE)


def lint_text(text: str, allowed_aspiration: set[str] | None = None,
              profile_text: str | None = None) -> dict:
    allowed_aspiration = allowed_aspiration or set()
    profile_terms = _terms(profile_text or "")
    violations: list[dict] = []
    warnings: list[dict] = []
    note_level = 0
    for heading, content in split_headings(text):
        if heading.startswith("#"):
            level = len(heading) - len(heading.lstrip("#"))
            note_level = level if is_note_section(heading) else (note_level if note_level and level > note_level else 0)
            if note_level:
                continue
        label = heading.lstrip("# ").strip() if heading.startswith("#") else heading
        sents = sentences(content)
        sole_placeholder = len(sents) == 1 and re.fullmatch(r"\[작성\s*필요\s*:[^\]]*\]", sents[0])
        previous_ending = None
        repeat_count = 0
        for sentence in sents:
            rules = []
            if ASPIRATION.search(sentence):
                permitted = any(label == allowed or allowed in label for allowed in allowed_aspiration)
                core = _terms(sentence)
                if not permitted or not (core & profile_terms):
                    rules.append("ASPIRATION")
            if ANALYSIS.search(sentence):
                rules.append("ANALYSIS")
            if SELF_DISQUALIFY.search(sentence):
                rules.append("SELF_DISQUALIFY")
            if not sole_placeholder and PLACEHOLDER.search(sentence):
                rules.append("PLACEHOLDER")
            ending = re.sub(r"[\s.!?。！？\"'”’]+$", "", sentence)
            ending_match = re.search(r"(?:했습니다|었습니다|았습니다|겠습니다|입니다|합니다|됩니다|습니다|어요|아요|해요|다|요)$", ending)
            ending = ending_match.group(0) if ending_match else ""
            if ending in {"했습니다", "었습니다", "았습니다"}:
                ending = "과거-습니다"
            if ending and ending == previous_ending:
                repeat_count += 1
            else:
                previous_ending, repeat_count = ending, 1
            if ending and repeat_count == 3:
                rules.append("REPEAT_ENDING")
            for rule in rules:
                violations.append({"section": label or "본문", "sentence": sentence, "rule": rule})
            if profile_text and profile_terms:
                terms = _terms(sentence)
                ratio = len(terms & profile_terms) / len(terms) if terms else 1.0
                if len(terms) >= 3 and ratio < 0.2:
                    warnings.append({"section": label or "본문", "sentence": sentence,
                                     "rule": "UNSUPPORTED_CANDIDATE", "overlap_ratio": round(ratio, 3)})
    return {"violations": violations, "warnings": warnings}


def main(argv: list[str] | None = None) -> int:
    force_utf8_output()
    parser = argparse.ArgumentParser(description="자기소개서 제출 본문을 결정적으로 검사합니다.")
    parser.add_argument("files", nargs="*", help="UTF-8 파일 경로 (생략하면 표준 입력)")
    parser.add_argument("--allow-aspiration", action="append", default=[], metavar="SECTION",
                        help="포부 표현을 허용할 섹션명 (프로필에 핵심어가 있어야 함)")
    parser.add_argument("--profile", help="지원자 프로필 Markdown 경로")
    parser.add_argument("--format", choices=("json", "table"), default="table")
    args = parser.parse_args(argv)
    try:
        inputs = [(str(p), p.read_text(encoding="utf-8")) for p in map(Path, args.files)]
        if not inputs:
            inputs = [("stdin", sys.stdin.read())]
        profile = Path(args.profile).read_text(encoding="utf-8") if args.profile else None
    except (OSError, UnicodeError) as exc:
        print(f"입력을 읽지 못했습니다: {exc}", file=sys.stderr)
        return 1
    results = []
    for source, content in inputs:
        result = {"file": source, **lint_text(content, set(args.allow_aspiration), profile)}
        results.append(result)
    if args.format == "json":
        print(json.dumps({"results": results}, ensure_ascii=False, indent=2))
    else:
        for result in results:
            for item in result["violations"]:
                print(f"위반 [{item['rule']}] {result['file']} / {item['section']} / {item['sentence']}")
            for item in result["warnings"]:
                print(f"경고 [{item['rule']}] {result['file']} / {item['section']} / {item['sentence']} (겹침 {item['overlap_ratio']:.0%})")
        if not any(r["violations"] or r["warnings"] for r in results):
            print("위반 없음")
    return 2 if any(r["violations"] for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
