"""Tests for the Korean application character counter CLI."""

import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from tools.kr_charcount import metrics, split_headings

REPO = Path(__file__).resolve().parent.parent
SCRIPT = REPO / "tools" / "kr_charcount.py"


class KoreanCharacterCountTests(unittest.TestCase):
    def test_metrics_nfc_spaces_newlines_and_encodings(self):
        result = metrics("한글A😀 e\n\t", count_newlines=True)
        self.assertEqual(result["with_spaces"], 6)
        self.assertEqual(result["without_spaces"], 5)
        self.assertIsNone(result["bytes_cp949"])
        self.assertEqual(result["cp949_unencodable"], ["😀"])
        self.assertEqual(metrics("가\u1100\u1161")["with_spaces"], 2)

    def test_headings_split_question_sections(self):
        parts = split_headings("# 제목\n소개\n## 문항 1\n답 1\n### 소제목\n하위\n")
        self.assertEqual([heading for heading, _ in parts], ["# 제목", "## 문항 1", "### 소제목"])
        self.assertEqual(parts[-1][1], "하위")

    def test_notes_excluded_by_default_and_included_on_request(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "answers.md"
            body = "문항 2 본문 약 200자입니다. 제출할 자기소개서 답변만 이 섹션에 있습니다.\n"
            notes = "- 작성 메모: 다음에 수정\n### 세부 메모\n참고 내용\n"
            path.write_text(f"# 제목\n## 문항 1\n답변\n## 문항 2\n{body}## 작성 메모 (제출 문항 아님)\n{notes}", encoding="utf-8")
            base = [sys.executable, SCRIPT, "--by-heading", "--format", "json", str(path)]
            proc = subprocess.run(base, capture_output=True)
            data = json.loads(proc.stdout.decode("utf-8"))
            rows = data["sections"]
            q2 = next(row for row in rows if row.get("heading") == "## 문항 2")
            self.assertEqual(q2["with_spaces"], len(body.strip()))
            self.assertEqual(data["excluded_sections"], 2)
            included = subprocess.run(base[:-1] + ["--include-notes", base[-1]], capture_output=True)
            included_data = json.loads(included.stdout.decode("utf-8"))
            self.assertEqual(included_data["excluded_sections"], 0)
            self.assertTrue(any("작성 메모" in row.get("heading", "") for row in included_data["sections"]))

    def test_reproduction_uses_trimmed_body_for_all_metrics(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "t.md"
            path.write_text("## 문항 1\n가나다 abc\n## 문항 2\n😀한글\n", encoding="utf-8")
            proc = subprocess.run([sys.executable, SCRIPT, "--by-heading", "--format", "json", str(path)], capture_output=True)
        rows = json.loads(proc.stdout.decode("utf-8"))["sections"]
        self.assertEqual((rows[0]["with_spaces"], rows[0]["bytes_utf8"], rows[0]["bytes_cp949"]), (7, 13, 10))
        self.assertEqual(rows[1]["bytes_utf8"], len("😀한글".encode("utf-8")))
        self.assertIsNone(rows[1]["bytes_cp949"])
        self.assertEqual(rows[1]["cp949_unencodable"], ["😀"])

    def test_newline_option_applies_to_both_character_and_byte_counts(self):
        without_newlines = metrics("가\n나")
        with_newlines = metrics("가\n나", count_newlines=True)
        self.assertEqual(without_newlines["with_spaces"], 2)
        self.assertEqual(without_newlines["bytes_utf8"], len("가나".encode("utf-8")))
        self.assertEqual(with_newlines["with_spaces"], 3)
        self.assertEqual(with_newlines["bytes_utf8"], len("가\n나".encode("utf-8")))
        self.assertEqual(with_newlines["bytes_cp949"], len("가\n나".encode("cp949")))

    def test_table_exposes_cp949_encoding_failure(self):
        proc = subprocess.run([sys.executable, SCRIPT], input="😀\n".encode("utf-8"), capture_output=True)
        out = proc.stdout.decode("utf-8")
        self.assertIn("CP949 계산 불가", out)
        self.assertIn("U+1F600(😀)", out)

    def test_limit_pass_and_exceeded_exit_code(self):
        env = dict(os.environ, PYTHONIOENCODING="cp1252", PYTHONUTF8="0")
        passed = subprocess.run([sys.executable, SCRIPT, "--limit", "7", "--format", "json"], input="한글A".encode(), capture_output=True, env=env)
        self.assertEqual(passed.returncode, 0, passed.stderr.decode("utf-8", "replace"))
        self.assertFalse(json.loads(passed.stdout.decode("utf-8"))["sections"][0]["exceeded"])
        exceeded = subprocess.run([sys.executable, SCRIPT, "--limit", "2", "--mode", "without-spaces"], input="한글 A".encode(), capture_output=True, env=env)
        self.assertEqual(exceeded.returncode, 2, exceeded.stderr.decode("utf-8", "replace"))
        self.assertIn("초과", exceeded.stdout.decode("utf-8"))
        self.assertNotIn(b"UnicodeEncodeError", exceeded.stderr)

    def test_by_heading_cli(self):
        with TemporaryDirectory() as tmp:
            path = Path(tmp) / "answers.md"
            path.write_text("## 문항 1\n한글\n## 문항 2\nA\n", encoding="utf-8")
            proc = subprocess.run([sys.executable, SCRIPT, str(path), "--by-heading", "--format", "json"], capture_output=True)
        rows = json.loads(proc.stdout.decode("utf-8"))["sections"]
        self.assertEqual([row["with_spaces"] for row in rows], [2, 1])
        self.assertEqual(proc.returncode, 0)


if __name__ == "__main__":
    unittest.main()
