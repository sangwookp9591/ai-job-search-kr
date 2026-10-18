"""/apply-kr 필수 산출 파일·완료 조건·근거표 인용 규칙이 문서에 남아 있는지 고정한다."""
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
APPLY_KR = (REPO / ".claude" / "commands" / "apply-kr.md").read_text(encoding="utf-8")
RULES = (REPO / ".claude" / "rules" / "kr-application.md").read_text(encoding="utf-8")
TEMPLATE = (REPO / "templates" / "kr" / "공고분석.md").read_text(encoding="utf-8")


class RequiredFilesTest(unittest.TestCase):
    def test_required_files_per_applicant_type(self):
        for text in (APPLY_KR, RULES):
            normalized = text.replace(" · ", "·")
            self.assertIn("`공고분석.md`·`근거표.md`·`자기소개서.md`·`프로젝트경험.md`", normalized)
            self.assertIn("`공고분석.md`·`근거표.md`·`자기소개서.md`·`경력기술서.md`", normalized)

    def test_missing_records_still_create_files(self):
        self.assertIn("기록이 부족해도 파일은 만든다", APPLY_KR)

    def test_completion_requires_glob_confirmation(self):
        self.assertIn("산출 파일 존재 확인", APPLY_KR)
        self.assertIn("실제 `Glob`", APPLY_KR)

    def test_evidence_quote_rule(self):
        for text in (APPLY_KR, RULES, TEMPLATE):
            self.assertIn("EVIDENCE_NOT_IN_PROFILE", text)
            self.assertIn("--profile", text)


if __name__ == "__main__":
    unittest.main()
