import { expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"
test("알 수 없는 플래그를 stderr JSON으로 거부", async () => { const result = await runCLI(["search", "-q", "백엔드", "--bogus"]); expect(result.exitCode).toBe(1); expect(parseJSON(result.stderr).code).toBe("UNKNOWN_FLAG") })
