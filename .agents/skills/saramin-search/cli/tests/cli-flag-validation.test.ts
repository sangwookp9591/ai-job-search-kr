import { expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"
test("알 수 없는 플래그를 stderr JSON으로 거부", async () => { const result = await runCLI(["search", "-q", "백엔드", "--bogus"]); expect(result.exitCode).toBe(1); expect(parseJSON(result.stderr).code).toBe("UNKNOWN_FLAG") })
test("kebab-case와 camelCase 옵션을 정규화하고 알 수 없는 플래그를 계속 거부", async () => {
  for (const option of ["--save-under=/tmp/jobs", "--saveUnder=/tmp/jobs"]) {
    const result = await runCLI(["detail", "invalid", option])
    expect(result.exitCode).toBe(1)
    expect(parseJSON(result.stderr).code).toBe("API_ERROR")
    expect(parseJSON(result.stderr).error).toContain("공고 ID")
  }
})
