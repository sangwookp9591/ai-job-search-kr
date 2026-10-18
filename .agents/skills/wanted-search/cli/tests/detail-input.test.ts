import { describe, expect, test } from "bun:test"
import { parseJobId } from "../src/commands/detail.js"
describe("detail input", () => {
  test("accepts numeric ids and wanted URLs", () => { expect(parseJobId("392946")).toBe("392946"); expect(parseJobId("https://www.wanted.co.kr/wd/392946?foo=1")).toBe("392946") })
  test("rejects unrelated hosts and paths", () => { expect(parseJobId("https://evil.example/wd/12")).toBeNull(); expect(parseJobId("https://wanted.co.kr/company/12")).toBeNull() })
})
