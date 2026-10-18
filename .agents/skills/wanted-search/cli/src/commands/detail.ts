import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { apiFetch, useOfficialApi, OPENAPI_BASE, WEB_BASE, normalizeDetail, writeError, type Job, resetHttpRequests, getHttpRequests } from "../helpers.js"

export function parseJobId(value: string): string | null {
  const text = value.trim()
  if (/^\d+$/.test(text)) return text
  try {
    const u = new URL(text)
    if (u.hostname !== "wanted.co.kr" && !u.hostname.endsWith(".wanted.co.kr")) return null
    return u.pathname.match(/^\/wd\/(\d+)/)?.[1] ?? null
  } catch { return null }
}

export const detail = defineCommand({
  name: "detail", description: "원티드 채용공고 상세 조회",
  options: {
    format: option(z.enum(["json", "plain"]).default("json"), { description: "출력 형식" }),
    unofficial: option(z.boolean().default(false), { description: "비공식 웹 JSON 사용을 허용 (개인 사용 전용, robots 정책 미확인)" }),
  },
  handler: async ({ positional, flags }) => { resetHttpRequests();
    const input = positional[0]
    if (!input) { writeError("Job ID or URL is required", "MISSING_REQUIRED"); process.exit(1) }
    const id = parseJobId(input)
    if (!id) { writeError("Provide a Wanted job ID or wanted.co.kr/wd/<id> URL", "INVALID_JOB_ID"); process.exit(1) }
    const official = useOfficialApi(flags.unofficial)
    if (!official) process.stderr.write("⚠️ 정책 미확인 비공식 엔드포인트: 개인 사용 전용입니다.\n")
    const url = official ? `${OPENAPI_BASE}/jobs/${encodeURIComponent(id)}` : `${WEB_BASE}/api/v4/jobs/${encodeURIComponent(id)}`
    const headers: Record<string, string> = official ? { "wanted-client-id": process.env.WANTED_CLIENT_ID!, "wanted-client-secret": process.env.WANTED_CLIENT_SECRET! } : {}
    try {
      const raw = await apiFetch<any>(url, headers)
      const result = normalizeDetail(raw, official ? "wanted-openapi" : "wanted-web")
      if (flags.format === "json") console.log(JSON.stringify({ meta: { http_requests: getHttpRequests() }, result }, null, 2))
      else { process.stderr.write(`http_requests: ${getHttpRequests()}\n`); outputPlain(result) }
    } catch (e) { writeError(e instanceof Error ? e.message : String(e), "API_ERROR"); process.exit(1) }
  },
})
function outputPlain(j: Job) {
  console.log(`제목: ${j.title}\n회사: ${j.company ?? "-"}\n위치: ${j.location ?? "-"}\n경력: ${j.career ?? "-"}\n학력: ${j.education ?? "-"}\n고용형태: ${j.employment_type ?? "-"}\n보상금: ${j.reward ? JSON.stringify(j.reward) : "-"}\n태그: ${j.tags?.join(", ") || "-"}\n마감: ${j.deadline ?? "-"}\nURL: ${j.url}\n출처: ${j.source}`)
  const labels: Record<string, string> = { main_tasks: "주요업무", requirements: "자격요건", preferred_points: "우대사항", benefits: "혜택" }
  for (const [key, label] of Object.entries(labels)) console.log(`\n[${label}]\n${j.sections?.[key as keyof NonNullable<Job["sections"]>] ?? "-"}`)
}
