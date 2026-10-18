import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { savePosting, savePostingUnder } from "../src/save.js"
const payload = (result: any): any => ({ meta: { http_requests: 1 }, result: { url: "https://www.wanted.co.kr/wd/1", source: "wanted-openapi", ...result } })
describe("detail save", () => {
  test("preserves NBSP description bytes", async () => { const dir = await mkdtemp(join(tmpdir(), "wanted-save-")); try { const desc = "가나다\u00a0라마바"; await savePosting(dir, payload({ sections: { main_tasks: desc } }), false); const md = await readFile(join(dir, "job_posting.md")); expect(md.subarray(md.indexOf("\n\n") + 2).toString("hex")).toBe(Buffer.from(desc).toString("hex")) } finally { await rm(dir, { recursive: true, force: true }) } })
  test("protects existing output files", async () => { const dir = await mkdtemp(join(tmpdir(), "wanted-save-")); try { await writeFile(join(dir, "job_posting.json"), "keep"); await expect(savePosting(dir, payload({ sections: {} }), false)).rejects.toThrow(); expect(await readFile(join(dir, "job_posting.json"), "utf8")).toBe("keep") } finally { await rm(dir, { recursive: true, force: true }) } })
  test("save-under sanitizes names, records the directory and reuses matching ids", async () => { const dir = await mkdtemp(join(tmpdir(), "wanted-under-")); try { const first = payload({ id: "42", company: "㈜테스트 회사", title: "..개발/엔지니어..", sections: { main_tasks: "원문" } }); const target = await savePostingUnder(dir, first, false); expect(target).toContain("테스트_회사_개발_엔지니어"); expect(first.meta.saved_dir).toBe(target); const again = payload({ id: "42", company: "테스트 회사", title: "개발/엔지니어", sections: { main_tasks: "변경" } }); await savePostingUnder(dir, again, false); expect(again.meta.reused).toBe(true); expect(await readFile(join(target, "job_posting.md"), "utf8")).toContain("원문") } finally { await rm(dir, { recursive: true, force: true }) } })
  test("save-under adds a job id when a name already belongs to another posting", async () => { const dir = await mkdtemp(join(tmpdir(), "wanted-under-")); try { await savePostingUnder(dir, payload({ id: "1", company: "회사", title: "직무", sections: {} }), false); const second = payload({ id: "2", company: "회사", title: "직무", sections: {} }); const target = await savePostingUnder(dir, second, false); expect(target.endsWith("회사_직무_2")).toBe(true) } finally { await rm(dir, { recursive: true, force: true }) } })
  test("save-under normalizes portal title variants", async () => {
    const dir = await mkdtemp(join(tmpdir(), "wanted-under-"))
    try {
      const cases = [["(주)한빛", "[(주)한빛] 백엔드 개발자(D-25)", "한빛_백엔드_개발자"], ["테스트 회사", "테스트회사 [플랫폼] 엔지니어 D-3", "테스트_회사_플랫폼_엔지니어"], ["잡코리아", "[잡코리아] 데이터 분석가(~10/25)", "잡코리아_데이터_분석가"], ["원티드", "프론트엔드 개발자 (상시)", "원티드_프론트엔드_개발자"], ["빈회사", "", "빈회사_직무"]]
      for (const [index, [company, title, expected]] of cases.entries()) { const saved = await savePostingUnder(dir, payload({ id: `case-${index}`, company, title, sections: {} }), false); expect(saved.endsWith(expected)).toBe(true) }
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})
