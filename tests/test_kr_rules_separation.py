"""한국어 지원서 전역 규칙은 프로필(CLAUDE.md)과 분리된 .claude/rules/ 파일에 있어야 한다."""

import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RULES = (REPO / ".claude" / "rules" / "kr-application.md").read_text(encoding="utf-8")
CLAUDE_MD = (REPO / "CLAUDE.md").read_text(encoding="utf-8")
SETUP = (REPO / ".claude" / "commands" / "setup.md").read_text(encoding="utf-8")
APPLY_KR = (REPO / ".claude" / "commands" / "apply-kr.md").read_text(encoding="utf-8")
README_KO = (REPO / "README.ko.md").read_text(encoding="utf-8")


class KrRulesSeparation(unittest.TestCase):
    def test_rules_live_in_auto_loaded_rules_file_without_paths_frontmatter(self):
        self.assertFalse(RULES.lstrip().startswith("---"))
        for needle in ("미래 의향·포부 문장 금지", "/apply-kr 절차로 진행합니다", "10-korean-applications.md",
                       "--evidence", "--analysis", "_general/", "역할·동사 격상 금지"):
            self.assertIn(needle, RULES)

    def test_root_claude_md_only_points_to_rules(self):
        self.assertIn(".claude/rules/kr-application.md", CLAUDE_MD)
        self.assertNotIn("미래 의향·포부 문장 금지", CLAUDE_MD)

    def test_setup_does_not_touch_rules_file(self):
        self.assertIn(".claude/rules/kr-application.md", SETUP)

    def test_lint_flags_and_evidence_table_are_documented(self):
        for needle in ("--evidence", "--analysis", "근거표.md", "EVIDENCE_MISSING", "UNSUPPORTED_NEGATIVE"):
            self.assertIn(needle, APPLY_KR)

    def test_readme_links_official_memory_docs(self):
        self.assertIn("https://code.claude.com/docs/en/memory", README_KO)


if __name__ == "__main__":
    unittest.main()
