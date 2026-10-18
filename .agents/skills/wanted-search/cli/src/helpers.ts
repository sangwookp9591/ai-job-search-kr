export const WEB_BASE = "https://www.wanted.co.kr"
export const OPENAPI_BASE = "https://openapi.wanted.jobs/v1"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export function hasOpenApiCredentials(): boolean {
  return Boolean(process.env.WANTED_CLIENT_ID && process.env.WANTED_CLIENT_SECRET)
}

export async function apiFetch<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  let delay = 500
  for (let attempt = 0; attempt <= 6; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": "wanted-search-cli/1.0 (personal job search)", Accept: "application/json", ...headers },
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === 6) throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      await new Promise((resolve) => setTimeout(resolve, delay + Math.floor(Math.random() * 500)))
      delay = Math.min(delay * 2, 5000)
      continue
    }
    if (!response.ok) throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    return response.json() as Promise<T>
  }
  throw new Error("API request failed after max retries")
}

export interface Job {
  id: string
  title: string
  company: string | null
  location: string | null
  posted_at: string | null
  deadline: string | null
  date: string | null
  career: string | null
  education: string | null
  employment_type: string | null
  url: string
  source: "wanted-openapi" | "wanted-web"
  annual_from?: number | null
  annual_to?: number | null
  tags?: string[]
  reward?: unknown
  sections?: { main_tasks: string | null; requirements: string | null; preferred_points: string | null; benefits: string | null }
}

export function normalizeSearch(data: any, source: Job["source"]): Job[] {
  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.jobs) ? data.jobs : Array.isArray(data?.results) ? data.results : []
  return rows.map((row: any): Job => {
    const job = row.job ?? row
    const id = String(job.id ?? job.job_id ?? "")
    const loc = job.address?.full_location ?? job.address?.location ?? job.location ?? null
    const deadline = job.due_time ?? job.deadline ?? null
    const annualFrom = job.annual_from ?? null
    const annualTo = job.annual_to ?? null
    let career: string | null = null
    if (annualFrom !== null || annualTo !== null) {
      if ((annualFrom ?? 0) === 0 && (annualTo ?? 0) === 0) career = "신입"
      else if (annualTo === null || annualTo >= 100) career = `${annualFrom ?? 0}년 이상`
      else if ((annualFrom ?? 0) === 0) career = `${annualTo}년 이하`
      else career = `${annualFrom}~${annualTo}년`
    }
    return {
      id,
      title: job.position ?? job.title ?? "",
      company: job.company?.name ?? job.company_name ?? null,
      location: loc,
      posted_at: job.created_at ?? job.posted_at ?? null,
      deadline: deadline ? (String(deadline).slice(0, 10)) : null,
      date: job.created_at ?? job.posted_at ? String(job.created_at ?? job.posted_at).slice(0, 10) : deadline ? String(deadline).slice(0, 10) : null,
      career,
      education: job.education ?? null,
      employment_type: job.employment_type ?? null,
      url: `https://www.wanted.co.kr/wd/${encodeURIComponent(id)}`,
      source,
      annual_from: annualFrom,
      annual_to: annualTo,
      tags: Array.isArray(job.tags) ? job.tags.map((tag: any) => typeof tag === "string" ? tag : tag.title).filter(Boolean) : [],
      reward: job.reward ?? null,
    }
  }).filter((job: Job) => job.id)
}

export function normalizeDetail(data: any, source: Job["source"]): Job {
  const base = data?.job ?? data
  const [card] = normalizeSearch({ data: [base] }, source)
  if (!card) throw new Error("Job detail payload did not contain a job")
  const details = base.detail ?? base
  const sections = {
    main_tasks: details.main_tasks ?? null,
    requirements: details.requirements ?? null,
    preferred_points: details.preferred_points ?? null,
    benefits: details.benefits ?? null,
  }
  return { ...card, sections, tags: [ ...(card.tags ?? []), ...(Array.isArray(base.company_tags) ? base.company_tags.map((tag: any) => tag.title) : []), ...(Array.isArray(base.skill_tags) ? base.skill_tags.map((tag: any) => tag.title) : []) ].filter(Boolean) }
}
