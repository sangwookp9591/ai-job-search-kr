import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { BASE_URL, htmlFetch, enrichmentEnabled, careerMatches, parseDetail, parseSearch, writeError, resetHttpRequests, getHttpRequests } from "../helpers.js"

export const search = defineCommand({
  name: "search", description: "잡코리아 공개 채용공고 검색",
  options: {
    query: option(z.string().optional(), { short: "q", description: "검색어" }),
    page: option(z.coerce.number().int().min(1).default(1), { description: "페이지" }),
    limit: option(z.coerce.number().int().min(1).max(50).default(10), { description: "최대 결과 수" }),
    enrichLimit: option(z.coerce.number().int().min(0).max(50).default(5), { description: "메타 보강 최대 공고 수" }),
    location: option(z.string().optional(), { short: "l", description: "지역" }),
    career: option(z.string().optional(), { description: "신입, 경력 또는 무관" }),
    sort: option(z.string().default(""), { description: "정렬" }),
    enrich: option(z.boolean().default(true), { description: "메타 보강 (기본값 true, --no-enrich로 끔)" }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), { description: "출력 형식" }),
  },
  handler: async ({ flags, signal }) => {
    resetHttpRequests()
    if (!flags.query) { writeError("--query는 필수입니다", "MISSING_REQUIRED"); process.exit(1) }
    try {
      const url = new URL("/Search/", BASE_URL)
      url.searchParams.set("stext", flags.query); url.searchParams.set("Page", String(flags.page))
      if (flags.location) url.searchParams.set("local", flags.location)
      if (flags.career) url.searchParams.set("careerType", flags.career === "신입" ? "1" : flags.career === "경력" ? "2" : flags.career === "무관" ? "3" : flags.career)
      if (signal.aborted) return
      let results = parseSearch(await htmlFetch(url.href))
      if (flags.career) results = results.filter(job => careerMatches(job.career, flags.career))
      results = results.slice(0, flags.limit)
      const enrichEnabled = enrichmentEnabled(process.argv, flags.enrich)
      if (enrichEnabled) for (const job of results.slice(0, flags.enrichLimit)) {
        try {
          const html = await htmlFetch(job.url)
          const detail = parseDetail(html, job.id, job.url)
          job.career = job.career ?? detail.career; job.education = detail.education; job.employment_type = detail.employment_type
          job.deadline = detail.deadline; job.deadline_text = detail.deadline_text; job.valid_through = detail.valid_through
          job.posted_at = detail.posted_at; job.date = job.posted_at ?? job.deadline ?? null; job.location = job.location ?? detail.location
        } catch { /* keep fields null when metadata enrichment is unavailable */ }
      }
      if (signal.aborted) return
      const http_requests = getHttpRequests()
      if (flags.format === "json") console.log(JSON.stringify({ meta: { page: flags.page, count: results.length, enriched: enrichEnabled ? Math.min(results.length, flags.enrichLimit) : 0, http_requests, ...(!enrichEnabled && results.some(job => !job.deadline && !job.deadline_text) ? { deadline_unavailable_without_enrich: true } : {}) }, results }, null, 2))
      else {
        process.stderr.write(`http_requests: ${http_requests}\n`)
        for (const job of results) console.log(flags.format === "table" ? `${job.id}\t${job.title}\t${job.company ?? "-"}\t${job.location ?? "-"}\t${job.career ?? "-"}\t${job.date ?? "-"}\t${job.url}` : `${job.title}\n${job.company ?? "-"} · ${job.url}\n게시일 또는 마감일: ${job.date ?? "-"}\n`)
      }
    } catch (error) { writeError(error instanceof Error ? error.message : String(error), "API_ERROR"); process.exit(1) }
  },
})
