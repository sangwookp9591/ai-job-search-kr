---
name: job-application-assistant
description: >
  Assists with job applications: evaluating job postings, tailoring CVs, writing cover letters,
  and preparing for interviews. Triggers on keywords like: job posting, job application, CV,
  cover letter, resume, interview prep, job fit, career, application, apply, ansøgning, stilling
allowed-tools: Read, Glob, Grep, WebFetch, WebSearch, Bash, Edit, Write, AskUserQuestion
framework_version: 1.3.4
---

# Job Application Assistant

---

## Market routing (read first)

- **Korean posting** (Korean-language posting, a JobKorea / Saramin / Wanted URL, or Korean application questions with character limits): read `10-korean-applications.md` and run `/apply-kr`. It produces Markdown text deliverables (공고분석, 자기소개서, 경력기술서 or 프로젝트경험) under `documents/applications/<company>_<role>/`, with no PDF or LaTeX. Follow the Korean branches in `03-writing-style.md`, `04-job-evaluation.md` and `08-application-forms.md`. A Korean posting gets Korean deliverables.
- **Any Korean application sentence request, with or without `/apply-kr`** ("직무 경험 자소서 700자 써줘", "경력기술서 써줘", "프로젝트경험 정리해줘", 이력서 문장): do not answer from the general workflow below. Say "/apply-kr 절차로 진행합니다" and run `.claude/commands/apply-kr.md`'s writing and verification steps as written: evidence table (every sentence mapped to a profile line or a user-confirmed record) → body → character count (`tools/kr_charcount.py`) → lint (`python3 tools/kr_application_lint.py <file> --profile .claude/skills/job-application-assistant/01-candidate-profile.md --format table`, repeat until exit 0, re-check `UNSUPPORTED_CANDIDATE` warnings against the table) → Korean checklist. A chat-only request still saves the body to a file (`documents/applications/_general/`) so the lint can run; only linted text is shown. No posting URL or pasted posting does not skip any of this.
- **Everything else** (English, Danish and other markets): the workflow below, unchanged.

## Workflow

When the user provides a job posting (URL or text), follow this workflow:

### Step 1: Research & Evaluate Fit
- Fetch the job posting content (use WebFetch for URLs). **A 403 is not a dead end** - follow the escalation order in `09-web-research.md` before concluding a page is unavailable, and prefer the employer's own careers posting over an aggregator listing
- Keep the **full posting text verbatim** for Step 3b to archive - never a summary
- Analyze the posting for required competencies, keywords, and priorities
- Research the company (website, LinkedIn, mission, recent news), per `09-web-research.md`
- Score the posting against the candidate's profile using the framework in `04-job-evaluation.md`
- Present the evaluation table and verdict
- Suggest whether the candidate should call the employer before applying (see `04-job-evaluation.md` for guidance)
- Ask the user if they want to proceed with an application

### Step 2: Tailor CV
- Before writing either document, derive `<company>_<role>` once by the **Subfolder naming** rule in `documents/README.md`; reuse that exact value for the CV, cover letter, and Step 3b archive path. If the rule says to stop because the derived name is empty, stop before creating any file.
- Read the most relevant existing CV variant from `cv/` as a starting point
- Follow the guidelines in `05-cv-templates.md`
- Create `cv/main_<company>_<role>.tex` with tailored content
- Adjust: profile statement, skills section, experience bullet emphasis, section order

### Step 3: Write Cover Letter
- Follow the writing style rules in `03-writing-style.md` (critical: no em-dashes, no cliches)
- Follow the template structure in `06-cover-letter-templates.md`
- Create `cover_letters/cover_<company>_<role>.tex`
- Ensure the letter connects specific experience to the role requirements

### Step 3b: Record the Application
- Run this once both documents exist. A CV or cover letter drafted alone is not yet an application.
- Follow **`/apply` Step 6b** (`.claude/commands/apply.md`) exactly: same header, same match-then-update rule, same `drafted` row, same posting archive, same prohibition on touching `job_scraper/seen_jobs.json`. It is stated there once so the two paths cannot drift. Four of its values are named in `/apply`'s own terms: `cv_file`/`cover_letter_file` are the paths written in Steps 2 and 3 here, `source` is the posting URL from Step 1, `deadline` is the application deadline from the posting text Step 1 keeps verbatim (empty when the posting states none - never guess one), and the posting text item 7 archives is the one Step 1 read.
- This step exists here because `/scrape` Step 5 routes straight into this skill. Without it, that path writes two documents and records nothing.

### Step 4: Interview Preparation
- Follow the framework in `07-interview-prep.md`
- Prepare STAR-format answers for likely questions
- Identify role-specific talking points
- Draft questions the candidate should ask the interviewer

---

## Reference Files

| File | Purpose |
|------|---------|
| `01-candidate-profile.md` | Education, experience, skills, publications, awards |
| `02-behavioral-profile.md` | Behavioral assessment, strengths, ideal environments |
| `03-writing-style.md` | Tone, structure, do's and don'ts |
| `04-job-evaluation.md` | Scoring framework for job fit |
| `05-cv-templates.md` | LaTeX CV structure and tailoring rules |
| `06-cover-letter-templates.md` | LaTeX cover letter structure and tailoring rules |
| `07-interview-prep.md` | STAR examples, tough questions, roleplay guidelines |
| `08-application-forms.md` | Portal free-text fields: self-introduction, project entries, character-limited pitches |
| `10-korean-applications.md` | Korean market: 신입 공채 vs 경력 수시, 자기소개서 question types, 경력기술서 structure, submission-format principle, personal-data caution. Used by `/apply-kr` |
| `09-web-research.md` | Fetching postings and company pages: trust boundary, the WebFetch 403 fallback, escalation order, claim verification |

---

## Quick Commands

The user may also ask for individual steps without the full workflow:
- "Evaluate this job posting" - Step 1 only
- "Write a CV for [company]" - Step 2 only
- "Write a cover letter for [role] at [company]" - Step 3 only
- "Help me prepare for an interview at [company]" - Step 4 only
- "이 공고 지원서 써줘" / a Korean posting / "자소서 써줘" without a command - `/apply-kr` procedure incl. the lint (see Market routing)
- "What jobs should I look for?" - Career strategy discussion using profile + evaluation framework
