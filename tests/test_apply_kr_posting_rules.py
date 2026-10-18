"""/apply-kr must fetch a posting once, keep its text verbatim, and not infer 미충족 for unrecorded holdings."""

import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
APPLY_KR = (REPO / ".claude" / "commands" / "apply-kr.md").read_text(encoding="utf-8")
GUIDE = (REPO / ".claude" / "skills" / "job-application-assistant" / "10-korean-applications.md").read_text(encoding="utf-8")
CLAUDE_MD = (REPO / "CLAUDE.md").read_text(encoding="utf-8")
README_KO = (REPO / "README.ko.md").read_text(encoding="utf-8")
TEMPLATE = (REPO / "templates" / "kr" / "공고분석.md").read_text(encoding="utf-8")


class ApplyKrPostingRules(unittest.TestCase):
    def test_single_fetch_saved_as_json(self):
        for needle in ("job_posting.json", "공고당 한 번만", "다시 조회하지 않고", "새로고침"):
            self.assertIn(needle, APPLY_KR)
        self.assertIn("job_posting.json", GUIDE)
        self.assertIn("job_posting.json", CLAUDE_MD)

    def test_posting_md_is_verbatim_description(self):
        for needle in ("한 글자도 고치지 않고", "재묶음", "result.source", "NBSP", "--save-under documents/applications", "meta.saved_dir"):
            self.assertIn(needle, APPLY_KR)
        for stale in ("python3 -I -c", "> documents/applications/posting_"):
            self.assertNotIn(stale, APPLY_KR)
            self.assertNotIn(stale, GUIDE)
        self.assertIn("손대지 않은 원문", TEMPLATE)

    def test_unrecorded_holdings_are_needs_check(self):
        for text in (APPLY_KR, GUIDE):
            self.assertIn("포트폴리오", text)
            self.assertIn("포트폴리오가 없다는 뜻이 아니다", text)
        self.assertIn("포트폴리오가 없다", CLAUDE_MD)

    def test_portal_cli_precheck_points_to_installer(self):
        for text in (APPLY_KR, GUIDE):
            self.assertIn("node_modules/zod/package.json", text)
            self.assertIn("python3 tools/install_portal_clis.py", text)
        self.assertIn("Cannot find module", APPLY_KR)
        self.assertNotIn("`Glob`으로 `.agents/skills/<skill>/cli/node_modules", APPLY_KR)
        self.assertIn("python3 tools/install_portal_clis.py", README_KO)
        self.assertIn("python3 tools/install_portal_clis.py", CLAUDE_MD)

    def test_submission_documents_carry_no_analysis_sections(self):
        career = (REPO / "templates" / "kr" / "경력기술서.md").read_text(encoding="utf-8")
        self.assertNotIn("## 공고 요구사항과 연결되는 순서", career)
        self.assertIn("제출 문서에는 제출 가능한 사실만", APPLY_KR)
        self.assertIn("제출 문서에는 제출 가능한 사실만", GUIDE)
        self.assertIn("제출 문서에 배치 의도", APPLY_KR.replace("(자기소개서·경력기술서·프로젝트경험)", ""))


if __name__ == "__main__":
    unittest.main()
