from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from tools.kr_application_lint import lint_text, main


class ApplicationLintTests(unittest.TestCase):
    def rules(self, text, **kwargs):
        return [item["rule"] for item in lint_text(text, **kwargs)["violations"]]

    def test_aspiration_positive_and_negative(self):
        self.assertIn("ASPIRATION", self.rules("# 답변\n입사 후 성장하겠습니다."))
        self.assertNotIn("ASPIRATION", self.rules("# 답변\nSpring Boot로 API를 구현했습니다."))

    def test_aspiration_section_requires_profile_overlap(self):
        text = "# 지원동기\nSpring Boot 역량을 키우겠습니다."
        self.assertNotIn("ASPIRATION", self.rules(text, allowed_aspiration={"지원동기"}, profile_text="Spring Boot 프로젝트 경험"))
        self.assertIn("ASPIRATION", self.rules(text, allowed_aspiration={"지원동기"}, profile_text="Python 데이터 분석"))
        self.assertIn("ASPIRATION", self.rules(text, profile_text="Spring Boot"))

    def test_analysis_positive_and_negative(self):
        self.assertIn("ANALYSIS", self.rules("# 답변\n공고의 요구사항을 대조해 충족 여부를 확인했습니다."))
        self.assertNotIn("ANALYSIS", self.rules("# 답변\n재고 검증 로직을 구현했습니다."))

    def test_self_disqualify_positive_and_negative(self):
        self.assertIn("SELF_DISQUALIFY", self.rules("# 답변\n운영 경험은 없습니다."))
        self.assertNotIn("SELF_DISQUALIFY", self.rules("# 답변\n운영 도구를 사용해 배포했습니다."))

    def test_placeholder_positive_and_negative(self):
        self.assertIn("PLACEHOLDER", self.rules("# 답변\n[회사명]에 지원합니다."))
        self.assertIn("PLACEHOLDER", self.rules("# 답변\nTODO 확인"))
        self.assertNotIn("PLACEHOLDER", self.rules("# 답변\n문서에 대괄호가 포함됩니다."))
        self.assertNotIn("PLACEHOLDER", self.rules("# 답변\n[작성 필요: 경험을 적어 주세요]"))

    def test_repeat_ending_positive_and_negative(self):
        self.assertIn("REPEAT_ENDING", self.rules("# 답변\n기능을 만들었습니다. 테스트를 작성했습니다. 결과를 확인했습니다."))
        self.assertNotIn("REPEAT_ENDING", self.rules("# 답변\n기능을 만들었습니다. 테스트를 작성하고 결과를 확인했습니다."))

    def test_note_sections_and_descendants_excluded(self):
        result = lint_text("# 답변\n성장하겠습니다.\n## 작성 메모\nTODO 경험은 없습니다.\n### 하위 메모\n공고의 요구사항\n## 제출 문항 아님\n부족하지만")
        self.assertEqual([v["rule"] for v in result["violations"]], ["ASPIRATION"])

    def test_d2_p1b_minimized_real_output_detects_violations(self):
        # Minimal excerpt copied from the D2-P1b output; contains no personal data.
        sample = ("팀 프로젝트에서 Spring Boot로 주문 API를 직접 구현했습니다.\n\n"
                  "Kafka나 실서비스 운영 경험은 없습니다. 다만 API를 구현하고 기본기를 쌓았습니다.\n"
                  "공고의 REST API 기반 서비스 개발 업무에서도 이 습관이 도움이 되리라 생각합니다.\n"
                  "입사 후에는 기존 기능을 개선하며 역량을 키우겠습니다.\n\n"
                  "## 작성 메모\n글자 수를 확인해 주세요. [회사명]")
        rules = self.rules(sample)
        self.assertIn("SELF_DISQUALIFY", rules)
        self.assertIn("ANALYSIS", rules)
        self.assertIn("ASPIRATION", rules)
        self.assertNotIn("PLACEHOLDER", rules)

    def test_profile_warning_does_not_change_exit_code(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "answer.md"
            profile = Path(directory) / "profile.md"
            source.write_text("# 답변\n우주선 항법 장치를 설계하며 양자 상태를 분석했습니다.", encoding="utf-8")
            profile.write_text("Spring Boot 주문 API 프로젝트", encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(source), "--profile", str(profile), "--format", "json"])
            self.assertEqual(code, 0)
            self.assertIn("UNSUPPORTED_CANDIDATE", output.getvalue())

    def test_json_format_and_rule_exit_code(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = main(["--format", "json"])
        # stdin is empty in the test runner, which is a clean input.
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output.getvalue()), {"results": [{"file": "stdin", "violations": [], "warnings": []}]})


if __name__ == "__main__":
    unittest.main()
