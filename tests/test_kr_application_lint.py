from __future__ import annotations

import contextlib
import io
import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from tools.kr_application_lint import lint_text, main, sentences


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
        self.assertNotIn("PLACEHOLDER", self.rules("# 답변\n[Spring Boot 주문 API]를 구현했습니다."))
        self.assertIn("PLACEHOLDER", self.rules("# 답변\n[YOUR_COMPANY]에 지원합니다."))

    def test_question_placeholder_ignores_analysis_and_aspiration(self):
        text = "## 문항 1 지원동기\n[작성 필요: 공고의 어떤 요구사항에 기여하고 싶은지 알려 주세요.]\n[작성 필요: 입사 후 성장하고 싶은 분야를 알려 주세요.]"
        self.assertEqual(self.rules(text), [])

    def test_placeholder_paragraph_does_not_hide_fact_in_same_section(self):
        text = "## 문항 1\n[작성 필요: 지원 계기를 알려 주세요.]\n\n운영 경험은 없지만 프로젝트를 진행했습니다."
        rules = self.rules(text)
        self.assertIn("SELF_DISQUALIFY", rules)

    def test_multiline_placeholder_paragraph_is_excluded_from_evidence_checks(self):
        from tools.kr_application_lint import _evidence_check, _evidence_gap_warnings
        body = ("## 문항 1 지원동기\n[작성 필요: 지원 계기를 알려 주세요. 질문 목록에 답해 주세요.]\n"
                "- [작성 필요: 어떤 경험이 있나요?]\n- [작성 필요: 무엇을 배웠나요?]\n\n"
                "팀 프로젝트에서 주문 API를 구현했습니다.")
        evidence = '| 문장 | 근거 |\n|---|---|\n| 팀 프로젝트에서 주문 API를 구현했습니다. | 프로필 "팀 프로젝트에서 주문 API를 구현했습니다" |'
        self.assertEqual(_evidence_check(body, evidence), [])
        self.assertEqual(_evidence_gap_warnings(body, evidence), [])

    def test_placeholder_sentence_mixed_with_fact_remains_placeholder_violation(self):
        text = "## 문항 1\n팀 프로젝트에서 [작성 필요: 구체적인 역할] API를 구현했습니다."
        self.assertIn("PLACEHOLDER", self.rules(text))

    def test_metadata_before_first_question_is_excluded(self):
        text = "# 자기소개서\n작성일: 공고의 요구사항을 대조했습니다.\n근거: [회사명]\n## 문항 1\nSpring Boot로 주문 API를 구현했습니다."
        self.assertEqual(self.rules(text), [])

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

    def test_evidence_mode_keeps_candidate_overlap_warning(self):
        with tempfile.TemporaryDirectory() as directory:
            source, evidence, profile = (Path(directory) / name for name in ("answer.md", "evidence.md", "profile.md"))
            source.write_text("## 문항 1\n우주선 항법 장치를 설계하며 양자 상태를 분석했습니다.", encoding="utf-8")
            evidence.write_text('| 문장 | 근거 |\n|---|---|\n| 우주선 항법 장치를 설계하며 양자 상태를 분석했습니다. | 프로필 "우주선 항법 장치를 설계하며 양자 상태를 분석했습니다" |', encoding="utf-8")
            profile.write_text("Spring Boot 주문 API 프로젝트", encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(source), "--evidence", str(evidence), "--profile", str(profile), "--format", "json"])
            self.assertEqual(code, 2)
            warning_rules = [w["rule"] for w in json.loads(output.getvalue())["results"][0]["warnings"]]
            self.assertIn("UNSUPPORTED_CANDIDATE", warning_rules)

    def test_json_format_and_rule_exit_code(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = main(["--format", "json"])
        # stdin is empty in the test runner, which is a clean input.
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(output.getvalue()), {"results": [{"file": "stdin", "violations": [], "warnings": []}]})

    def test_evidence_table_matching_and_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            answer, evidence = Path(directory) / "answer.md", Path(directory) / "evidence.md"
            answer.write_text("## 문항 1\n안내 글을 작성했습니다.\n추가 공지를 게시했습니다.", encoding="utf-8")
            evidence.write_text('| 문장 | 근거 | 프로필 원문 동사 / 산출 동사 |\n|---|---|---|\n| 안내 글을 작성했습니다. | 프로필 "안내 글을 작성했습니다" | 작성 / 작성 |\n| 추가 공지를 게시했습니다. | 없음 | 게시 / 게시 |', encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(answer), "--evidence", str(evidence), "--format", "json"])
            self.assertEqual(code, 2)
            rules = [v["rule"] for v in json.loads(output.getvalue())["results"][0]["violations"]]
            self.assertEqual(rules, ["EVIDENCE_EMPTY", "EVIDENCE_NOT_IN_PROFILE"])

    def test_evidence_missing_and_negative_analysis(self):
        with tempfile.TemporaryDirectory() as directory:
            answer, evidence, analysis = (Path(directory) / name for name in ("answer.md", "evidence.md", "analysis.md"))
            answer.write_text("## 문항 1\n확인된 문장입니다.\n누락된 문장입니다.", encoding="utf-8")
            evidence.write_text('| 문장 | 근거 |\n|---|---|\n| 확인된 문장입니다. | 프로필 "확인된 문장입니다" |', encoding="utf-8")
            analysis.write_text("| 요구사항 | 관련 내 경험 | 근거 | 판정 |\n|---|---|---|---|\n| 마케팅 경력 | 없음 | 프로필에 없음 | 미충족 |", encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(answer), "--evidence", str(evidence), "--analysis", str(analysis), "--format", "json"])
            self.assertEqual(code, 2)
            rules = [v["rule"] for v in json.loads(output.getvalue())["results"][0]["violations"]]
            self.assertEqual(rules, ["EVIDENCE_MISSING", "UNSUPPORTED_NEGATIVE"])

    def test_evidence_mode_still_flags_unmatched_normal_sentence(self):
        with tempfile.TemporaryDirectory() as directory:
            answer, evidence, profile = (Path(directory) / name for name in ("answer.md", "evidence.md", "profile.md"))
            answer.write_text("## 문항 1\n[작성 필요: 경험을 알려 주세요.]\n\n근거가 없는 일반 문장입니다.", encoding="utf-8")
            evidence.write_text("| 문장 | 근거 |\n|---|---|\n", encoding="utf-8")
            profile.write_text("프로젝트 경험", encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(answer), "--evidence", str(evidence), "--profile", str(profile), "--format", "json"])
            result = json.loads(output.getvalue())["results"][0]
            self.assertEqual(code, 2)
            self.assertEqual([v["rule"] for v in result["violations"]], ["EVIDENCE_MISSING"])
            self.assertEqual(result["violations"][0]["sentence"], "근거가 없는 일반 문장입니다.")

    def test_supported_negative_quote_must_exist_in_profile(self):
        analysis = '| 요구사항 | 근거 | 판정 |\n|---|---|---|\n| 광고 경험 | 명시 부정: 프로필 "광고 집행 경험 없음" | 미충족 |'
        from tools.kr_application_lint import _negative_check
        self.assertEqual(_negative_check(analysis, "광고 집행 경험 없음"), [])
        self.assertEqual(_negative_check(analysis, "광고 경험 있음")[0]["rule"], "UNSUPPORTED_NEGATIVE")
        unrelated = '| 요구사항 | 근거 | 판정 |\n|---|---|---|\n| 퍼포먼스 마케팅 경력 | 명시 부정: 프로필 "광고 집행 경험 없음" | 미충족 |'
        self.assertEqual(_negative_check(unrelated, "광고 집행 경험 없음")[0]["rule"], "UNSUPPORTED_NEGATIVE")

    def test_evidence_paragraph_boundary_separates_placeholder_from_fact(self):
        text = "## 문항 1\n[작성 필요: 지원 계기를 알려 주세요.]\n\n팀 프로젝트에서 Spring Boot 주문 API를 구현했습니다."
        self.assertEqual(sentences(text), ["[작성 필요: 지원 계기를 알려 주세요.]", "팀 프로젝트에서 Spring Boot 주문 API를 구현했습니다."])

    def test_evidence_quote_must_be_profile_verbatim_and_gap_is_warning(self):
        from tools.kr_application_lint import _evidence_profile_check, _evidence_gap_warnings
        body = "## 문항 1\n캠페인 참여자가 20% 늘었습니다."
        evidence = '| 문장 | 근거 |\n|---|---|\n| 캠페인 참여자가 20% 늘었습니다. | 프로필 "안내 글을 작성했습니다" |'
        self.assertEqual(_evidence_profile_check(evidence, "안내 글을 작성했습니다"), [])
        self.assertEqual(_evidence_profile_check(evidence, "다른 내용" )[0]["rule"], "EVIDENCE_NOT_IN_PROFILE")
        warning = _evidence_gap_warnings(body, evidence)[0]
        self.assertEqual(warning["rule"], "EVIDENCE_GAP")
        self.assertTrue(warning["missing_quantities"])

    def test_evidence_without_profile_is_unverified_and_quote_required(self):
        with tempfile.TemporaryDirectory() as directory:
            answer, evidence = Path(directory) / "answer.md", Path(directory) / "evidence.md"
            answer.write_text("## 문항 1\n안내 글을 작성했습니다.", encoding="utf-8")
            evidence.write_text("| 문장 | 근거 |\n|---|---|\n| 안내 글을 작성했습니다. | 프로필 항목 |", encoding="utf-8")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                code = main([str(answer), "--evidence", str(evidence), "--format", "json"])
            result = json.loads(output.getvalue())["results"][0]
            self.assertEqual(code, 2)
            self.assertIn("EVIDENCE_NOT_IN_PROFILE", [v["rule"] for v in result["violations"]])
            self.assertIn("EVIDENCE_UNVERIFIED", [w["rule"] for w in result["warnings"]])

    def test_no_arguments_with_tty_stops_with_usage_error(self):
        class TtyInput(io.StringIO):
            def isatty(self):
                return True
        with contextlib.redirect_stderr(io.StringIO()), patch("sys.stdin", TtyInput("")):
            self.assertEqual(main([]), 1)


if __name__ == "__main__":
    unittest.main()
