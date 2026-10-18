import { mkdir, writeFile, unlink, readFile, access } from "node:fs/promises"
import { join, resolve } from "node:path"
export async function savePosting(dir: string, payload: { meta: { http_requests: number }; result: any }, force: boolean) {
  await mkdir(dir, { recursive: true })
  const jsonPath = join(dir, "job_posting.json"), mdPath = join(dir, "job_posting.md"), result = payload.result
  const imageOnly = result.image_only === true
  const description = imageOnly ? `image_urls:\n${(result.image_urls ?? []).map((url: string) => `- ${url}`).join("\n")}` : String(result.description ?? "")
  const markdown = `출처 URL: ${result.url}\n조회 시각: ${new Date().toISOString()}\nsource: ${result.source}${imageOnly ? "\n본문이 이미지라 텍스트가 없다" : ""}\n\n${description}`
  if (!force) { await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" }); try { await writeFile(mdPath, markdown, { flag: "wx" }) } catch (error) { await unlink(jsonPath).catch(() => {}); throw error } }
  else { await writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`); await writeFile(mdPath, markdown) }
}
function companyText(value: unknown) { return String(value ?? "").replace(/주식회사|\(주\)|㈜/g, "").replace(/\s+/g, "").toLowerCase() }
function safePart(value: unknown, fallback: string) { const part = String(value ?? "").replace(/주식회사|\(주\)|㈜/g, "").replace(/\s+/g, "_").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/^\.+|\.+$/g, "").slice(0, 40).replace(/^\.+|\.+$/g, ""); return part || fallback }
function safeTitle(value: unknown, company: unknown, fallback: string) {
  const companyName = companyText(company); let title = String(value ?? "").trim()
  const leadingBracket = title.match(/^\[([^\]]+)\]\s*/)
  if (leadingBracket && companyName && companyText(leadingBracket[1]).includes(companyName)) title = title.slice(leadingBracket[0].length)
  title = title.replace(/\s*(?:\(D-\d+\)|D-\d+|\(~?\d{1,2}\/\d{1,2}\)|\(마감임박\)|\(상시\))\s*$/i, "").trim()
  const companyRaw = String(company ?? "").replace(/주식회사|\(주\)|㈜/g, "").trim()
  if (companyName && companyText(title).startsWith(companyName)) title = title.slice(companyRaw.length).trim()
  title = title.replace(/[\[\](){}]/g, "").replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "")
  const part = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/_+/g, "_").replace(/^[_\.]+|[_\.]+$/g, "").slice(0, 40).replace(/^[_\.]+|[_\.]+$/g, "")
  return part || fallback
}
export async function savePostingUnder(base: string, payload: any, force: boolean) {
  const result = payload.result, id = String(result.id), primary = resolve(base, `${safePart(result.company, "회사")}_${safeTitle(result.title, result.company, "직무")}`), primaryJson = join(primary, "job_posting.json")
  await mkdir(primary, { recursive: true })
  try { await access(primaryJson); const existing = JSON.parse(await readFile(primaryJson, "utf8")); if (String(existing.result?.id) === id) { payload.meta.saved_dir = primary; payload.meta.reused = true; return primary } } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  let target = primary
  try { await access(primaryJson); target = `${primary}_${id}` } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  await mkdir(target, { recursive: true })
  try { const existing = JSON.parse(await readFile(join(target, "job_posting.json"), "utf8")); if (String(existing.result?.id) === id) { payload.meta.saved_dir = target; payload.meta.reused = true; return target } throw new Error(`저장 경로에 다른 공고 파일이 있습니다: ${target}`) } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  payload.meta.saved_dir = target; await savePosting(target, payload, force); return target
}
