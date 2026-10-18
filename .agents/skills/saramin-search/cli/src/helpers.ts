import { parse } from "node-html-parser"

export const API_URL = "https://oapi.saramin.co.kr/job-search"
export const WEB_URL = "https://www.saramin.co.kr"
export type Job = { id: string; title: string; company: string | null; location: string | null; posted_at: string | null; deadline: string | null; date: string | null; deadline_text?: string | null; career: string | null; education: string | null; employment_type: string | null; is_ad?: boolean; url: string; source: "saramin-api" | "saramin-web" }
export function writeError(error: string, code: string) { process.stderr.write(JSON.stringify({ error, code }) + "\n") }
export async function fetchText(url: string, accept = "text/html,application/xhtml+xml") {
  let delay = 500
  for (let attempt = 0; attempt <= 4; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; saramin-cli/0.1; personal job search)", Accept: accept, "Accept-Language": "ko-KR,ko;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(15000) })
    if (response.status === 429 || response.status >= 500) { if (attempt === 4) throw new Error(`요청 실패: HTTP ${response.status}`); await new Promise(resolve => setTimeout(resolve, delay)); delay = Math.min(delay * 2, 4000); continue }
    if (!response.ok) throw new Error(`요청 실패: HTTP ${response.status}`)
    return response.text()
  }
  throw new Error("요청 재시도 초과")
}
function value(input: any): string | null { if (input == null) return null; if (typeof input === "string" || typeof input === "number") return String(input); if (Array.isArray(input)) return value(input[0]); return value(input.name ?? input.title ?? input.value) }
export function parseApi(data: any): Job[] {
  const jobs = data?.jobs?.job ?? []
  return (Array.isArray(jobs) ? jobs : jobs ? [jobs] : []).map((job: any) => {
    const postedAt = value(job["posting-date"]) ?? (job["posting-timestamp"] ? new Date(Number(job["posting-timestamp"]) * 1000).toISOString() : null)
    const deadline = value(job["expiration-date"]) ?? (job["expiration-timestamp"] ? new Date(Number(job["expiration-timestamp"]) * 1000).toISOString() : null)
    return {
      id: String(job.id ?? ""),
      title: value(job.position?.title) ?? "",
      company: value(job.company?.detail?.name ?? job.company?.name),
      location: value(job.position?.location),
      posted_at: postedAt, deadline, date: postedAt ?? deadline,
      deadline_text: value(job["expiration-date"]), career: value(job["experience-level"]?.name ?? job["experience-level"]),
      education: value(job["required-education-level"]?.name ?? job["required-education-level"]),
      employment_type: value(job.position?.["job-type"]), is_ad: false,
      url: `${WEB_URL}/zf_user/jobs/relay/view?rec_idx=${job.id}`, source: "saramin-api" as const,
    }
  })
}
export function filterJobsByCareer(jobs: Job[], career?: string): Job[] {
  if (!career || !/^\s*(?:신입|경력)\s*$/.test(career)) return jobs
  // Search cards, including paid placements, can escape the server-side filter.
  const allowed = /^\s*(?:신입|신입\s*[·/]\s*경력|경력무관)\s*$/
  return jobs.filter(job => {
    const value = (job.career ?? "").replace(/\s+/g, " ").trim()
    return career.trim() === "신입" ? allowed.test(value) : /^(?:경력\s*\d+(?:\s*[~～-]\s*\d+)?\s*년(?:\s*(?:↑|이상|이하|\+))?|경력무관|신입\s*[·/]\s*경력)$/.test(value)
  })
}
export function applyWebCareerFilter(params: URLSearchParams, career?: string): void {
  if (/^\s*신입\s*$/.test(career ?? "")) { params.set("exp_cd", "1"); params.set("exp_none", "y") }
  else if (/^\s*경력\s*$/.test(career ?? "")) { params.set("exp_cd", "2"); params.set("exp_none", "y") }
  else if (career) params.set("career", career)
}
export function deadlineFields(raw: string | null | undefined, now = new Date()): { deadline: string | null; deadline_text: string | null } {
  const text = raw?.trim() ?? null
  if (!text || /상시채용|채용시(?:\s*마감)?|수시/.test(text)) return { deadline: null, deadline_text: text }
  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)
  const part = (type: string) => dateParts.find(item => item.type === type)?.value ?? ""
  const todayIso = `${part("year")}-${part("month")}-${part("day")}`
  const addDay = (value: string, days: number) => new Date(Date.parse(`${value}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
  if (/오늘\s*마감/.test(text)) return { deadline: todayIso, deadline_text: text }
  if (/내일\s*마감/.test(text)) return { deadline: addDay(todayIso, 1), deadline_text: text }
  const match = text.match(/(\d{4})[.년/-]\s*(\d{1,2})[.월/-]\s*(\d{1,2})/) ?? text.match(/(\d{1,2})\s*\/\s*(\d{1,2})/)
  if (!match) return { deadline: null, deadline_text: text }
  let year = match[3] ? Number(match[1]) : Number(part("year"))
  const month = Number(match[match.length === 4 ? 2 : 1]), day = Number(match[match.length === 4 ? 3 : 2])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return { deadline: null, deadline_text: text }
  if (!match[3] && `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` < todayIso) { year++; const next = new Date(year, month - 1, day); if (next.getMonth() !== month - 1) return { deadline: null, deadline_text: text } }
  return { deadline: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, deadline_text: text }
}
export function parseWeb(html: string): Job[] {
  const root = parse(html), results: Job[] = []
  const cards = root.querySelectorAll(".item_recruit")
  if (cards.length) for (const card of cards) {
    const anchor = card.querySelector('a[href*="rec_idx="]'), href = anchor?.getAttribute("href") ?? "", id = href.match(/rec_idx=(\d+)/)?.[1]
    if (!id || results.some(job => job.id === id)) continue
    const title = (card.querySelector(".job_tit")?.text ?? "").replace(/\s+/g, " ").trim()
    if (!title) continue
    const conditions = card.querySelectorAll(".job_condition span").map(node => node.text.trim()).filter(Boolean)
    const location = card.querySelector(".job_condition span:first-child")?.text.replace(/\s+/g, " ").trim() || null
    const career = conditions.find(text => /신입|경력|인턴/.test(text)) ?? null
    const education = conditions.find(text => /학력|졸업|대졸|초대졸|고졸|석사|박사|무관/.test(text) && !/경력/.test(text)) ?? null
    const employmentType = conditions.find(text => /정규직|계약직|인턴직|프리랜서|파견직|아르바이트|위촉직/.test(text)) ?? null
    const deadlineText = card.querySelector(".job_date .date")?.text.trim() ?? null
    const date = deadlineFields(deadlineText)
    const parsedLink = new URL(href, WEB_URL)
    const isAd = parsedLink.searchParams.get("paid_fl") === "y" || /paid_y/.test(card.getAttribute("data-data_layer") ?? "") || /paid_fl=y/.test(href)
    results.push({
      id,
      title,
      company: card.querySelector(".corp_name")?.text.trim() || null,
      location,
      posted_at: null, ...date,
      date: date.deadline,
      career, education, employment_type: employmentType,
      is_ad: isAd, url: `${WEB_URL}/zf_user/jobs/relay/view?rec_idx=${id}`, source: "saramin-web",
    })
  }
  if (cards.length) { if (!results.length) throw new Error("검색 결과를 파싱하지 못했습니다"); return results }
  for (const anchor of root.querySelectorAll('a[href*="rec_idx="]')) {
    const href = anchor.getAttribute("href") ?? "", id = href.match(/rec_idx=(\d+)/)?.[1]
    if (!id || results.some(job => job.id === id)) continue
    let card: any = anchor
    for (let i = 0; i < 5 && card?.parentNode; i++) { if (card.getAttribute?.("class")?.match(/item|job|recruit/i) || card.getAttribute?.("data-rec-idx")) break; card = card.parentNode }
    const title = (anchor.text.trim() || card.querySelector(".job_tit, .tit")?.text.trim() || "").replace(/\s+/g, " ")
    if (title.length < 2) continue
    const body = card.text.replace(/\s+/g, " ")
    results.push({ id, title, company: card.querySelector(".corp_name, .company_name")?.text.trim() || null,
      location: body.match(/(?:근무지역|지역)\s*[:：]?\s*([^|]+)/)?.[1]?.trim() ?? null,
      posted_at: null, deadline: null, date: null, career: body.match(/신입(?:·경력)?|경력(?:무관|\s*\d+년)?/)?.[0] ?? null,
      education: null, employment_type: null, url: href.startsWith("http") ? href : `${WEB_URL}${href.startsWith("/") ? "" : "/"}${href}`, source: "saramin-web" })
  }
  if (!results.length) throw new Error("검색 결과를 파싱하지 못했습니다")
  return results
}
export function parseDetail(html: string, id: string, url: string, source: Job["source"], summaryHtml = html) {
  const root = parse(html), summary = parse(summaryHtml)
  const title = summary.querySelector('meta[property="og:title"]')?.getAttribute("content")?.split(" | ")[0] ?? summary.querySelector("h1")?.text.trim() ?? ""
  if (!title) throw new Error("공고 제목을 찾지 못했습니다")
  const metaDescription = summary.querySelector('meta[name="description"]')?.getAttribute("content") ?? ""
  const field = (label: string) => metaDescription.match(new RegExp(`${label}\\s*:\\s*(.*?)(?=,\\s*(?:경력|학력|근무지역|고용형태|마감일)\\s*:|$)`, "i"))?.[1]?.trim() ?? null
  const detailField = (id: string) => root.querySelector(`#${id}`)?.text.replace(/\s+/g, " ").trim() ?? null
  const content = root.querySelector(".user_content")
  const imageOnly = Boolean(content && content.querySelectorAll("img").length && content.text.trim().length < 40)
  const description = content ? parse(content.innerHTML
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/(모집분야|담당업무|자격요건|우대사항|근무조건|전형절차|접수기간)/g, "\n$1"))
    .text.replace(/[ \t]*\n[ \t]*/g, "\n").replace(/\n{3,}/g, "\n\n").trim() : ""
  const deadline = deadlineFields(field("마감일") ?? detailField("template_how_to_apply_period"))
  const career = field("경력") ?? content?.text.match(/경력\s*[:：]\s*([^\nㆍ]+)/)?.[1]?.trim() ?? null
  const education = field("학력") ?? content?.text.match(/학력\s*[:：]\s*([^\nㆍ]+)/)?.[1]?.trim() ?? null
  const employmentType = field("고용형태") ?? detailField("template_job_type_job_type") ?? root.querySelector("#template_job_type .value")?.text.trim() ?? root.querySelector("#template_job_type")?.text.replace(/.*고용형태\s*[:：]\s*/, "").trim() ?? null
  const address = detailField("template_job_type_aw_post_address") ?? root.querySelector("#template_address .value")?.text.trim() ?? root.querySelector("#template_address")?.text.replace(/.*근무지\s*[:：]\s*/, "").trim() ?? null
  const location = field("근무지역") ?? address?.match(/(?:\(\d{5}\)\s*)?((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^,\n]*)/)?.[1]?.trim() ?? null
  return { id, title: title.replace(/\s*-\s*사람인$/, ""), company: metaDescription.split(",")[0]?.trim() || title.match(/^\[([^\]]+)\]/)?.[1] || null, location, posted_at: null, ...deadline, date: deadline.deadline, career, education, employment_type: employmentType?.replace(/\s+/g, " ").trim() ?? null, is_ad: false, url, source, description: description || null, image_only: imageOnly }
}
export async function loadSearch(query: string, page: number, count: number, filters: { location?: string; career?: string; sort?: string }) {
  const key = process.env.SARAMIN_ACCESS_KEY
  if (key) { const params = new URLSearchParams({ "access-key": key, keywords: query, start: String(page - 1), count: String(count), sort: filters.sort ?? "pd", fields: "posting-date expiration-date" }); if (filters.location) params.set("loc_cd", filters.location); if (filters.career) params.set("experience-level", filters.career); return filterJobsByCareer(parseApi(JSON.parse(await fetchText(`${API_URL}?${params}`, "application/json"))), filters.career).slice(0, count) }
  const params = new URLSearchParams({ searchword: query, page: String(page) }); if (filters.location) params.set("loc", filters.location)
  applyWebCareerFilter(params, filters.career)
  if (filters.sort) params.set("sort", filters.sort)
  return filterJobsByCareer(parseWeb(await fetchText(`${WEB_URL}/zf_user/search/recruit?${params}`)), filters.career).slice(0, count)
}
export async function loadDetail(id: string, enrich = false) {
  const key = process.env.SARAMIN_ACCESS_KEY
  const url = `${WEB_URL}/zf_user/jobs/relay/view?rec_idx=${encodeURIComponent(id)}`
  const [summary, detail] = await Promise.all([fetchText(url), fetchText(`${WEB_URL}/zf_user/jobs/relay/view-detail?rec_idx=${encodeURIComponent(id)}`)])
  const parsed = parseDetail(detail, id, url, key ? "saramin-api" : "saramin-web", summary)
  let webJob: Job | undefined
  if (enrich || key) try { webJob = (await loadSearch(parsed.title.replace(/^\[[^\]]+\]\s*/, ""), 1, 20, {})).find(job => job.id === id) } catch { /* Detail fields remain available when optional enrichment fails. */ }
  if (!key) return { ...parsed, ...(webJob ? { location: webJob.location ?? parsed.location, deadline: webJob.deadline ?? parsed.deadline, deadline_text: webJob.deadline_text ?? parsed.deadline_text, career: webJob.career ?? parsed.career, education: webJob.education ?? parsed.education, employment_type: webJob.employment_type ?? parsed.employment_type, is_ad: webJob.is_ad ?? parsed.is_ad } : {}), metadata_missing_reasons: { location: parsed.location ? null : "상세 응답에 근무지역 정보가 없습니다.", career: parsed.career ? null : "상세 응답에 경력 정보가 없습니다.", education: parsed.education ? null : "상세 응답에 학력 정보가 없습니다.", employment_type: parsed.employment_type ? null : "상세 응답에 고용형태 정보가 없습니다.", deadline: parsed.deadline || parsed.deadline_text ? null : "상세 응답에 마감 정보가 없습니다." } }
  const params = new URLSearchParams({ "access-key": key, id, fields: "posting-date expiration-date" })
  const apiJob = parseApi(JSON.parse(await fetchText(`${API_URL}?${params}`, "application/json")))[0]
  if (!apiJob) throw new Error("공고를 찾지 못했습니다")
  return { ...parsed, ...apiJob, location: webJob?.location ?? parsed.location, deadline: apiJob.deadline ?? webJob?.deadline ?? parsed.deadline, deadline_text: webJob?.deadline_text ?? parsed.deadline_text, career: apiJob.career ?? webJob?.career ?? parsed.career, education: apiJob.education ?? webJob?.education ?? parsed.education, employment_type: apiJob.employment_type ?? webJob?.employment_type ?? parsed.employment_type, is_ad: webJob?.is_ad ?? parsed.is_ad, description: parsed.description, image_only: parsed.image_only }
}
