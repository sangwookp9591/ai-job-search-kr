import { parse } from "node-html-parser"
export const BASE_URL = "https://www.jobkorea.co.kr"
let httpRequests = 0
export function resetHttpRequests(): void { httpRequests = 0 }
export function getHttpRequests(): number { return httpRequests }
export function writeError(error: string, code: string): void { process.stderr.write(JSON.stringify({ error, code }) + "\n") }
export function enrichmentEnabled(args:string[], optionValue:boolean):boolean { return optionValue&&!args.some(value=>value==="--no-enrich"||value.startsWith("--no-enrich=")) }
export function careerMatches(career:string|null, requested:string|undefined):boolean {
 if(!requested) return true
 const value=requested.trim()
 if(value==="신입") return /^(신입|신입\s*[·/]\s*경력|경력무관)$/.test(career?.replace(/\s+/g," ")??"")
 if(value==="경력") return /^(경력(?:\s*\d+년↑)?|신입\s*[·/]\s*경력)$/.test(career?.replace(/\s+/g," ")??"")
 if(value==="무관") return /^(경력무관|무관)$/.test(career?.replace(/\s+/g," ")??"")
 return true
}
export async function htmlFetch(url: string): Promise<string> {
  let delay = 500
  for (let attempt = 0; attempt <= 4; attempt++) {
    httpRequests++
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; jobkorea-cli/0.1; personal job search)", Accept: "text/html,application/xhtml+xml", "Accept-Language": "ko-KR,ko;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(15000) })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === 4) throw new Error(`요청 실패: HTTP ${response.status}`)
      await new Promise(r => setTimeout(r, delay + Math.floor(Math.random() * 250))); delay = Math.min(delay * 2, 4000); continue
    }
    if (!response.ok) throw new Error(`요청 실패: HTTP ${response.status}`)
    return response.text()
  }
  throw new Error("요청 재시도 초과")
}
export interface Job { id:string; title:string; company:string|null; location:string|null; posted_at:string|null; deadline:string|null; date:string|null; deadline_text:string|null; valid_through:string|null; career:string|null; education:string|null; employment_type:string|null; is_ad:boolean; url:string; source:string }
export function dateTextToIso(value:string|null, now=new Date()): string|null {
 if(!value || /상시채용|채용시\s*마감|수시/.test(value)) return null
 if(/오늘\s*마감/.test(value)) return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`
 const relative=value.match(/D\s*[-−]\s*(\d+)/i)
 if(relative){const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()+Number(relative[1]));return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`}
 let m=value.match(/(\d{4})[.\-/년 ]\s*(\d{1,2})[.\-/월 ]\s*(\d{1,2})/)
 if(m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`
 m=value.match(/(\d{1,2})\s*\/\s*(\d{1,2})/); if(!m)return null
 let year=now.getFullYear(); const month=Number(m[1]), day=Number(m[2]); const date=new Date(year,month-1,day), today=new Date(now.getFullYear(),now.getMonth(),now.getDate())
 if(date<today)year++
 return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`
}
export function parseSearch(html:string): Job[] {
  const root=parse(html); const out:Job[]=[]
  for(const anchor of root.querySelectorAll('a[href*="/Recruit/GI_Read/"]')) {
    const href=anchor.getAttribute("href")??""; const match=href.match(/\/Recruit\/GI_Read\/(\d+)/); if(!match) continue
    const id=match[1]; let card=anchor.parentNode; while(card && !card.getAttribute?.("data-sentry-component")?.includes("CardJob")) card=card.parentNode
    const titleNode=card?.querySelector('[data-sentry-component="Title"]'); const title=titleNode?.text.trim().replace(/\s+/g," ")??""
    if(title.length<3 || out.some(x=>x.id===id)) continue
    const company=card?.querySelector("span.text-gray700")?.text.trim()??null
    const chips=card?.querySelectorAll('[data-sentry-component="GrayChip"]')??[]
    const location=chips.map(x=>x.text.trim()).find(x=>/^(서울|경기|인천|부산|대구|대전|광주|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/.test(x))??null
    const body=card?.text.replace(/\s+/g," ")??""
    const career=card?.querySelectorAll("span.text-gray700.text-typo-c1-13").map(x=>x.text.trim()).find(x=>/^(신입(?:·경력)?|경력(?:\s*\d+년↑|무관)?|인턴)$/.test(x))??body.match(/(경력무관|경력\s*\d+년↑|신입·경력|신입|경력|인턴)/)?.[1]??null
    const deadlineText=body.match(/(상시채용|채용시\s*마감|오늘\s*마감|D\s*[-−]\s*\d+|~?\s*\d{1,2}\/\d{1,2}(?:\([^)]*\))?|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/i)?.[1]?.trim()??null
    out.push({
      id,
      title: title,
      company: company,
      location: location,
      posted_at: null, deadline: dateTextToIso(deadlineText),
      date: dateTextToIso(deadlineText), deadline_text: deadlineText, valid_through: null,
      career, education: null, employment_type: null, is_ad: /\bAD\b/.test(body),
      url: `${BASE_URL}/Recruit/GI_Read/${id}`, source: "jobkorea",
    })
  }
  if(!out.length) throw new Error("검색 결과를 파싱하지 못했습니다"); return out
}
export function parseDetail(html:string,id:string,_url:string,bodyHtml="") {
 const root=parse(html); const title=root.querySelector('script[type="application/ld+json"]')?.text.match(/"title"\s*:\s*"([^"]+)"/)?.[1]??root.querySelector('meta[property="og:title"]')?.getAttribute("content")?.split(" | ")[0] ?? root.querySelector("h1")?.text.trim() ?? ""
 if(!title) throw new Error("공고 제목을 찾지 못했습니다")
 const summaryDescription=root.querySelector('meta[name="description"]')?.getAttribute("content")??root.querySelector('meta[property="og:description"]')?.getAttribute("content")??""
 const body=root.text.replace(/\s+/g," ").trim()
 const sourceText=summaryDescription||body
 const field=(label:string)=>sourceText.match(new RegExp(`${label}\\s*[:：]\\s*([^,|]+)`))?.[1]?.trim()??null
 const deadlineRaw=field("마감일")??sourceText.match(/(상시채용|채용시\s*마감|오늘\s*마감|D\s*[-−]\s*\d+|~?\s*\d{1,2}\/\d{1,2}(?:\([^)]*\))?|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/i)?.[1]?.trim()??null
 const deadlineText=deadlineRaw?.match(/상시채용|채용시\s*마감|오늘\s*마감|D\s*[-−]\s*\d+|~?\s*\d{1,2}\/\d{1,2}(?:\([^)]*\))?|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/i)?.[0]??deadlineRaw
 let posting:any=null
 for(const node of root.querySelectorAll('script[type="application/ld+json"]')) { try { const parsed=JSON.parse(node.text); const entries=Array.isArray(parsed)?parsed:[parsed]; posting=entries.find((entry:any)=>entry?.["@type"]==="JobPosting")??posting } catch { /* ignore unrelated or malformed structured data */ } }
 const jobLocation=posting?.jobLocation?.address
 const location=field("근무지역")??([jobLocation?.addressRegion,jobLocation?.addressLocality,jobLocation?.streetAddress].filter(Boolean).join(" ")||null)
 const postedAt=posting?.datePosted?.slice(0,10)??null
 const validThrough=posting?.validThrough?.slice(0,10)??null
 const indefiniteDeadline=deadlineText!==null&&/(상시채용|채용시\s*마감|수시)/.test(deadlineText)
 const employmentType=field("고용형태")??(posting?.employmentType==="FULL_TIME"?"정규직":posting?.employmentType??null)
 const career=field("경력")??posting?.experienceRequirements??null
 const education=field("학력")??posting?.educationRequirements??null
 let description:string|null=null, description_reason:string|null=null
 const iframe=parse(bodyHtml)
 for(const node of iframe.querySelectorAll("script,style,noscript,.devChargeEmail")) node.remove()
 const iframeHtml=iframe.innerHTML.replace(/<!doctype[^>]*>/gi,"").replace(/<\/(?:p|div|li|tr|h[1-6]|section|table|ul|ol)\s*>/gi,"\n").replace(/<br\s*\/?>/gi,"\n")
 let bodyText=parse(iframeHtml).textContent.replace(/\r\n?/g,"\n").replace(/\u00a0/g," ").replace(/[\t ]*\n[\t ]*/g,"\n").replace(/[\t ]+/g," ").split("\n").map(line=>line.trim()).join("\n").replace(/\n{3,}/g,"\n\n").trim()
 bodyText=bodyText.replace(/입사\s*지원하기/g,"").replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,"").replace(/\n{3,}/g,"\n\n").trim()
 const imageUrls=[...new Set(iframe.querySelectorAll("img").map(img=>img.getAttribute("src")??img.getAttribute("data-src")).filter((src):src is string=>Boolean(src&&/^(?:https?:)?\/\//i.test(src))).map(src=>src.startsWith("//")?`https:${src}`:src))]
 const hasTextBody=bodyText.length>=100
 const imageOnly=!hasTextBody&&imageUrls.length>0
 if(hasTextBody) description=bodyText
 else if(summaryDescription) description=summaryDescription
 else if(typeof posting?.description==="string") description=posting.description
 if(imageOnly) description_reason="모집요강이 이미지로 제공되어 텍스트 본문을 추출하지 못했습니다. image_urls의 이미지를 확인하세요."
 else if(!hasTextBody&&description) description_reason="본문 프레임에서 100자 이상의 텍스트를 찾지 못해 메타 요약만 제공했습니다."
 else if(!description) description_reason="모집요강 본문과 메타 요약을 찾지 못했습니다"
 const externalApplyUrl=iframe.querySelectorAll("a[href]").map(a=>a.getAttribute("href")??"").find(href=>/^https?:\/\//i.test(href)&&!new URL(href).hostname.endsWith("jobkorea.co.kr"))??null
 return {id,title,company:root.querySelector('meta[name="writer"]')?.getAttribute("content")??null,location,posted_at:postedAt,deadline:indefiniteDeadline?null:(dateTextToIso(deadlineText)??validThrough),deadline_text:deadlineText??validThrough,valid_through:validThrough,career,education,employment_type:employmentType,apply_method:/즉시지원/.test(body)?"잡코리아 즉시지원":/홈페이지 지원/.test(body)?"홈페이지 지원":null,external_apply_url:externalApplyUrl,external_apply_reason:externalApplyUrl?"본문 프레임에 잡코리아 외부 홈페이지 링크가 있습니다.":null,url:`${BASE_URL}/Recruit/GI_Read/${id}`,source:"jobkorea",description,description_source:hasTextBody?"posting_body":description?"meta_summary":null,image_only:imageOnly,image_urls:imageUrls,description_reason }
}
