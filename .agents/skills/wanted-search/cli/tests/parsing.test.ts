import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { normalizeDetail, normalizeSearch } from "../src/helpers.js"
const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"))
describe("Wanted payload normalization", () => {
  test("normalizes search fields and preserves Wanted-specific fields", () => {
    const [job] = normalizeSearch(fixture("search.json"), "wanted-web")
    expect(job).toMatchObject({ id: "392946", title: "[RDPLINE] 백엔드개발자 3년 이상", company: "비큐에이아이", location: "서울 중구", career: "3년 이상", source: "wanted-web", annual_from: 3, deadline: null, deadline_text: "상시", deadline_status: "rolling" })
    expect(job.url).toBe("https://www.wanted.co.kr/wd/392946")
  })
  test("distinguishes fixed, confirmed rolling, and unreported deadlines", () => {
    const [fixed] = normalizeSearch({ data: [{ id: 1, due_time: "2026-12-11T23:59:59Z" }] }, "wanted-web")
    const [rolling] = normalizeSearch({ data: [{ id: 2, due_time: null }] }, "wanted-web")
    const [missing] = normalizeSearch({ data: [{ id: 3 }] }, "wanted-web")
    const [unverifiedNull] = normalizeSearch({ data: [{ id: 4, due_time: null }] }, "wanted-openapi")
    expect(fixed).toMatchObject({ deadline: "2026-12-11", deadline_text: "2026-12-11T23:59:59Z", deadline_status: "fixed" })
    expect(rolling).toMatchObject({ deadline: null, deadline_text: "상시", deadline_status: "rolling" })
    expect(missing).toMatchObject({ deadline: null, deadline_text: "마감일 미표기", deadline_status: "unknown" })
    expect(unverifiedNull).toMatchObject({ deadline: null, deadline_text: "마감일 미표기", deadline_status: "unknown" })
  })
  test("preserves an explicit rolling label", () => {
    const [job] = normalizeSearch({ data: [{ id: 5, due_time: "상시채용" }] }, "wanted-web")
    expect(job).toMatchObject({ deadline: null, deadline_text: "상시채용", deadline_status: "rolling" })
  })
  test("separates application sections for downstream use", () => {
    const job = normalizeDetail(fixture("detail.json"), "wanted-web")
    expect(job.sections).toEqual({ main_tasks: "서비스 운영 및 안정화\n장애 대응", requirements: "Java/Spring Boot 경험", preferred_points: "Kafka 경험", benefits: "유연근무" })
    expect(job.tags).toContain("IT, 컨텐츠")
  })
})
