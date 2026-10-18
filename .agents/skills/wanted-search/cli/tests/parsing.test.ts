import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { normalizeDetail, normalizeSearch } from "../src/helpers.js"
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"))
describe("Wanted payload normalization", () => {
  test("normalizes search fields and preserves Wanted-specific fields", () => {
    const [job] = normalizeSearch(fixture("search.json"), "wanted-web")
    expect(job).toMatchObject({ id: "392946", title: "[RDPLINE] 백엔드개발자 3년 이상", company: "비큐에이아이", location: "서울 중구", career: "3년 이상", source: "wanted-web", annual_from: 3 })
    expect(job.url).toBe("https://www.wanted.co.kr/wd/392946")
  })
  test("separates application sections for downstream use", () => {
    const job = normalizeDetail(fixture("detail.json"), "wanted-web")
    expect(job.sections).toEqual({ main_tasks: "서비스 운영 및 안정화\n장애 대응", requirements: "Java/Spring Boot 경험", preferred_points: "Kafka 경험", benefits: "유연근무" })
    expect(job.tags).toContain("IT, 컨텐츠")
  })
})
