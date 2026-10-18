"""일반 요청(/apply-kr 없는 자소서 요청)도 /apply-kr 작성·검증 단계와 본문 린트로 라우팅돼야 한다."""

import json
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
APPLY_KR = (REPO / ".claude" / "commands" / "apply-kr.md").read_text(encoding="utf-8")
SKILL = (REPO / ".claude" / "skills" / "job-application-assistant" / "SKILL.md").read_text(encoding="utf-8")
CLAUDE_MD = (REPO / "CLAUDE.md").read_text(encoding="utf-8") + (REPO / ".claude" / "rules" / "kr-application.md").read_text(encoding="utf-8")
README_KO = (REPO / "README.ko.md").read_text(encoding="utf-8")
SETTINGS = json.loads((REPO / ".claude" / "settings.json").read_text(encoding="utf-8"))
GUARDS = (REPO / "tools" / "security_guards.py").read_text(encoding="utf-8")


class GeneralRequestRoute(unittest.TestCase):
    def test_routing_announced_in_all_entry_points(self):
        for text in (CLAUDE_MD, APPLY_KR, SKILL):
            self.assertIn("/apply-kr 절차로 진행합니다", text)
            self.assertIn("kr_application_lint.py", text)

    def test_lint_loop_until_exit_zero(self):
        for text in (CLAUDE_MD, APPLY_KR):
            self.assertIn("exit 0", text)
            self.assertIn("UNSUPPORTED_CANDIDATE", text)
        self.assertIn("## Step 5b", APPLY_KR)

    def test_chat_only_request_saves_body_to_file(self):
        for text in (CLAUDE_MD, APPLY_KR, SKILL):
            self.assertIn("documents/applications/_general/", text)

    def test_lint_permission_allowed_everywhere(self):
        allow = SETTINGS["permissions"]["allow"]
        for variant in ("python", "python3"):
            entry = f"Bash({variant} tools/kr_application_lint.py:*)"
            self.assertIn(entry, allow)
            self.assertIn(f'"{entry}"', GUARDS)
        self.assertIn("python3 tools/kr_application_lint.py *", README_KO)


if __name__ == "__main__":
    unittest.main()
