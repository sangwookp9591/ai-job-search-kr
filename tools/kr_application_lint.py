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
    # Markdown paragraph and heading boundaries always end a sentence. Keep a
    # 작성 필요 block intact even when its prompt contains punctuation.
    parts = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if QUESTION_PLACEHOLDER.fullmatch(line):
            parts.append(line)
            continue
        parts.extend(part.strip() for part in re.split(r"(?<=[.!?。！？])\s+", line) if part.strip())
    return parts


def _terms(text: str) -> set[str]:
    # Korean/English content words of at least two characters; ignore particles.
    words = re.findall(r"[가-힣]{2,}|[A-Za-z][A-Za-z0-9+#.]{1,}", text)
    particles = ("에서", "으로", "에게", "하고", "하며", "되어", "하는", "했다", "입니다", "습니다", "그리고", "하지만", "통해")
    return {w for w in words if w not in particles}


ASPIRATION = re.compile(r"겠습니다|싶습니다|하겠다|노력하|기여하고자|성장하|익혀\s*가겠|키우겠|배우겠")
ANALYSIS = re.compile(r"에 해당하는|공고의.{0,40}(?:요구|우대|자격|업무|개발)|요구사항|대조|충족|미충족")
SELF_DISQUALIFY = re.compile(r"경험은 없|경험이 없|없습니다만|부족하지만")
PLACEHOLDER = re.compile(r"\[(?:YOUR_[^\]]*|\d+\s*개|프로젝트명|회사명|작성\s*필요[^\]]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+|\.{2,}|OO+)\]|\bTODO\b", re.IGNORECASE)
QUESTION_PLACEHOLDER = re.compile(r"^\s*(?:\[작성\s*필요\s*:[^\]]*\]\s*)+$")


def _submission_sections(text: str):
    sections = split_headings(text)
    # Application files have a metadata preamble; only 문항 sections are submitted.
    first_question = next((i for i, (heading, _) in enumerate(sections)
                           if heading.startswith("##") and "문항" in heading and not is_note_section(heading)), None)
    if first_question is not None:
        sections = sections[first_question:]
    return sections


def _cells(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def _markdown_tables(text: str):
    lines = text.splitlines()
    for i, line in enumerate(lines[:-1]):
        if "|" not in line or not re.fullmatch(r"\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*", lines[i + 1]):
            continue
        headers = [re.sub(r"\s+", " ", c).strip().lower() for c in _cells(line)]
        rows = []
        for row_line in lines[i + 2:]:
            if "|" not in row_line:
                break
            cells = _cells(row_line)
            if len(cells) == len(headers):
                rows.append(dict(zip(headers, cells)))
        yield headers, rows


def _normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _evidence_check(body: str, evidence: str) -> list[dict]:
    violations = []
    rows = []
    for headers, table_rows in _markdown_tables(evidence):
        sentence_col = next((h for h in headers if h == "문장"), None)
        evidence_cols = [h for h in headers if h == "근거" or h == "프로필 근거"]
        if sentence_col and evidence_cols:
            rows = [(r.get(sentence_col, ""), " ".join(r.get(c, "") for c in evidence_cols)) for r in table_rows]
            break
    indexed = {_normalized(sentence): reason for sentence, reason in rows if sentence}
    for sentence in sentences(body):
        if _normalized(sentence) not in indexed:
            violations.append({"section": "본문", "sentence": sentence, "rule": "EVIDENCE_MISSING"})
        elif not indexed[_normalized(sentence)].strip() or re.fullmatch(r"\s*없음\s*", indexed[_normalized(sentence)]):
            violations.append({"section": "본문", "sentence": sentence, "rule": "EVIDENCE_EMPTY"})
    return violations


def _quoted_evidence(text: str) -> list[str]:
    return re.findall(r'"([^"\n]+)"|“([^”\n]+)”|「([^」\n]+)」', text)


def _quote_values(text: str) -> list[str]:
    return [next(value for value in group if value) for group in _quoted_evidence(text)]


def _evidence_profile_check(evidence: str, profile: str | None) -> list[dict]:
    violations = []
    for headers, rows in _markdown_tables(evidence):
        sentence_col = next((h for h in headers if h == "문장"), None)
        evidence_cols = [h for h in headers if h in {"근거", "프로필 근거"}]
        if not sentence_col or not evidence_cols:
            continue
        for row in rows:
            sentence = row.get(sentence_col, "")
            reason = " ".join(row.get(col, "") for col in evidence_cols)
            if not sentence.strip():
                continue
            quotes = _quote_values(reason)
            if not quotes or (profile is not None and not any(
                _normalized(quote) in _normalized(profile) for quote in quotes
            )):
                violations.append({"section": "근거표", "sentence": sentence,
                                   "rule": "EVIDENCE_NOT_IN_PROFILE"})
        break
    return violations


def _evidence_gap_warnings(body: str, evidence: str) -> list[dict]:
    indexed = {}
    for headers, rows in _markdown_tables(evidence):
        sentence_col = next((h for h in headers if h == "문장"), None)
        evidence_cols = [h for h in headers if h in {"근거", "프로필 근거"}]
        if sentence_col and evidence_cols:
            indexed = {_normalized(row.get(sentence_col, "")): " ".join(row.get(c, "") for c in evidence_cols)
                       for row in rows}
            break
    warnings = []
    for sentence in sentences(body):
        quote = " ".join(_quote_values(indexed.get(_normalized(sentence), "")))
        if not quote:
            continue
        sentence_terms = _terms(sentence)
        quote_terms = _terms(quote)
        missing_terms = sorted(sentence_terms - quote_terms)
        number_pattern = re.compile(r"\d+(?:[,.]\d+)?\s*(?:%|퍼센트|명|건|개|회|년|개월|주|일|원|배)?")
        missing_numbers = [n.strip() for n in number_pattern.findall(sentence)
                           if _normalized(n) not in _normalized(quote)]
        if missing_terms or missing_numbers:
            warnings.append({"section": "본문", "sentence": sentence, "rule": "EVIDENCE_GAP",
                             "missing_terms": missing_terms, "missing_quantities": missing_numbers})
    return warnings


def _negative_check(analysis: str, profile: str | None) -> list[dict]:
    violations = []
    for headers, rows in _markdown_tables(analysis):
        decision = next((h for h in headers if "판정" in h), None)
        evidence = next((h for h in headers if h == "근거" or "근거" in h), None)
        requirement = next((h for h in headers if "요구사항" in h), None)
        if not decision or not evidence:
            continue
        for row in rows:
            if "미충족" not in row.get(decision, ""):
                continue
            value = row.get(evidence, "")
            quotes = re.findall(r'["“”「」]([^"“”「」]+)["“”「」]', value)
            negation = re.compile(r"없음|없다|아님|안\s*함|미보유|않음|못\s*했|경험\s*없")
            requirement_terms = _terms(row.get(requirement, "")) if requirement else set()
            relevant_quotes = [q for q in quotes if _terms(q) & requirement_terms]
            if ("명시 부정" not in value or not any(negation.search(q) for q in relevant_quotes)
                    or (profile is not None and not any(q in profile for q in relevant_quotes))):
                violations.append({"section": "대조표", "sentence": row.get("요구사항", value), "rule": "UNSUPPORTED_NEGATIVE"})
        break
    return violations


def lint_text(text: str, allowed_aspiration: set[str] | None = None,
              profile_text: str | None = None) -> dict:
    allowed_aspiration = allowed_aspiration or set()
    profile_terms = _terms(profile_text or "")
    violations: list[dict] = []
    warnings: list[dict] = []
    note_level = 0
    for heading, content in _submission_sections(text):
        if heading.startswith("#"):
            level = len(heading) - len(heading.lstrip("#"))
            note_level = level if is_note_section(heading) else (note_level if note_level and level > note_level else 0)
            if note_level:
                continue
        label = heading.lstrip("# ").strip() if heading.startswith("#") else heading
        sents = sentences(content)
        question_section = bool(sents) and all(QUESTION_PLACEHOLDER.fullmatch(s) for s in sents)
        previous_ending = None
        repeat_count = 0
        for sentence in sents:
            rules = []
            is_question_placeholder = bool(QUESTION_PLACEHOLDER.fullmatch(sentence))
            if not question_section and not is_question_placeholder and ASPIRATION.search(sentence):
                permitted = any(label == allowed or allowed in label for allowed in allowed_aspiration)
                core = _terms(sentence)
                if not permitted or not (core & profile_terms):
                    rules.append("ASPIRATION")
            if not question_section and not is_question_placeholder and ANALYSIS.search(sentence):
                rules.append("ANALYSIS")
            if SELF_DISQUALIFY.search(sentence):
                rules.append("SELF_DISQUALIFY")
            if not question_section and not is_question_placeholder and PLACEHOLDER.search(sentence):
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
            if not question_section and not is_question_placeholder and profile_text and profile_terms:
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
    parser.add_argument("--evidence", help="문장별 근거표 Markdown 경로 (사용 시 --profile 필수)")
    parser.add_argument("--analysis", help="공고분석 Markdown 경로")
    parser.add_argument("--format", choices=("json", "table"), default="table")
    parser.epilog = "--evidence를 사용할 때는 --profile을 반드시 함께 지정하세요."
    args = parser.parse_args(argv)
    try:
        inputs = [(str(p), p.read_text(encoding="utf-8")) for p in map(Path, args.files)]
        if not inputs:
            if sys.stdin.isatty():
                parser.print_usage(sys.stderr)
                print("오류: 파일을 지정하거나 표준 입력을 파이프로 전달하세요.", file=sys.stderr)
                return 1
            inputs = [("stdin", sys.stdin.read())]
        profile = Path(args.profile).read_text(encoding="utf-8") if args.profile else None
        evidence = Path(args.evidence).read_text(encoding="utf-8") if args.evidence else None
        analysis = Path(args.analysis).read_text(encoding="utf-8") if args.analysis else None
    except (OSError, UnicodeError) as exc:
        print(f"입력을 읽지 못했습니다: {exc}", file=sys.stderr)
        return 1
    results = []
    for source, content in inputs:
        result = {"file": source, **lint_text(content, set(args.allow_aspiration), profile)}
        body_sections = _submission_sections(content)
        body = "\n".join(c for h, c in body_sections if not (h.startswith("#") and is_note_section(h)))
        if evidence is not None:
            result["violations"].extend(_evidence_check(body, evidence))
            result["violations"].extend(_evidence_profile_check(evidence, profile))
            result["warnings"].extend(_evidence_gap_warnings(body, evidence))
            if profile is None:
                result["warnings"].append({"section": "근거표", "sentence": "--profile 없이 근거표를 검사했습니다.",
                                           "rule": "EVIDENCE_UNVERIFIED"})
        if analysis is not None:
            result["violations"].extend(_negative_check(analysis, profile))
        results.append(result)
    if args.format == "json":
        print(json.dumps({"results": results}, ensure_ascii=False, indent=2))
    else:
        for result in results:
            for item in result["violations"]:
                print(f"위반 [{item['rule']}] {result['file']} / {item['section']} / {item['sentence']}")
            for item in result["warnings"]:
                detail = f" (겹침 {item['overlap_ratio']:.0%})" if "overlap_ratio" in item else ""
                if item.get("rule") == "EVIDENCE_GAP":
                    detail = f" (인용에 없는 핵심어: {', '.join(item['missing_terms'] + item['missing_quantities'])})"
                print(f"경고 [{item['rule']}] {result['file']} / {item['section']} / {item['sentence']}{detail}")
        if not any(r["violations"] or r["warnings"] for r in results):
            print("위반 없음")
    return 2 if any(r["violations"] for r in results) else 0


if __name__ == "__main__":
    sys.exit(main())
