import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { apiFetch, useOfficialApi, OPENAPI_BASE, WEB_BASE, normalizeSearch, writeError, type Job } from "../helpers.js"

export const search = defineCommand({
  name: "search", description: "원티드 채용공고 검색",
  options: {
    query: option(z.string().optional(), { short: "q", description: "검색어 (필수)" }),
    page: option(z.coerce.number().int().min(1).default(1), { description: "페이지 (1부터 시작)" }),
    limit: option(z.coerce.number().int().min(1).max(100).default(20), { description: "페이지당 결과 수 (최대 100)" }),
    location: option(z.string().optional(), { description: "지역명" }),
    career: option(z.string().optional(), { description: "경력: 신입 또는 경력" }),
    sort: option(z.string().optional(), { description: "정렬 옵션" }),
    unofficial: option(z.boolean().default(false), { description: "비공식 웹 JSON 사용을 허용 (개인 사용 전용, robots 정책 미확인)" }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), { description: "출력 형식" }),
  },
  handler: async ({ flags }) => {
    if (!flags.query?.trim()) { writeError("--query is required", "MISSING_REQUIRED"); process.exit(1) }
    const official = useOfficialApi(flags.unofficial)
    if (!official) process.stderr.write("⚠️ 정책 미확인 비공식 엔드포인트: 개인 사용 전용입니다.\n")
    const offset = (flags.page - 1) * flags.limit
    const url = official
      ? `${OPENAPI_BASE}/jobs?${new URLSearchParams({ query: flags.query, limit: String(flags.limit), offset: String(offset), ...(flags.location ? { location: flags.location } : {}), ...(flags.career ? { career: flags.career } : {}), ...(flags.sort ? { sort: flags.sort } : {}) })}`
      : `${WEB_BASE}/api/v4/jobs?${new URLSearchParams({ country: "kr", query: flags.query, limit: String(flags.limit), offset: String(offset) })}`
    const headers: Record<string, string> = official ? { "wanted-client-id": process.env.WANTED_CLIENT_ID!, "wanted-client-secret": process.env.WANTED_CLIENT_SECRET! } : {}
    try {
      const raw = await apiFetch<any>(url, headers)
      let results = normalizeSearch(raw, official ? "wanted-openapi" : "wanted-web")
      if (flags.location) results = results.filter((job) => job.location?.toLocaleLowerCase().includes(flags.location!.toLocaleLowerCase()))
      if (flags.career === "신입") results = results.filter((job) => job.annual_from === 0)
      else if (flags.career === "경력") results = results.filter((job) => (job.annual_from ?? 0) > 0)
      if (flags.sort === "date") results.sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""))
      const out = { meta: { total: raw.total_count ?? raw.total ?? null, page: flags.page, limit: flags.limit, source: official ? "wanted-openapi" : "wanted-web" }, results }
      if (flags.format === "json") console.log(JSON.stringify(out, null, 2))
      else if (flags.format === "table") outputTable(results)
      else outputPlain(results)
    } catch (e) { writeError(e instanceof Error ? e.message : String(e), "API_ERROR"); process.exit(1) }
  },
})
function outputTable(rows: Job[]) {
  console.log("id       title                                      company                location                       date")
  for (const j of rows) console.log(`${j.id.padEnd(8)} ${j.title.slice(0, 40).padEnd(40)} ${(j.company ?? "-").slice(0, 22).padEnd(22)} ${j.location ?? "-"} ${j.date ?? "-"}`)
}
function outputPlain(rows: Job[]) {
  for (const j of rows) console.log(`id: ${j.id}\ntitle: ${j.title}\ncompany: ${j.company ?? "-"}\nlocation: ${j.location ?? "-"}\ndate: ${j.date ?? "-"}\ncareer: ${j.career ?? "-"}\nurl: ${j.url}\nsource: ${j.source}\n`)
}
