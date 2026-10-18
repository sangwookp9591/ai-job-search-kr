---
name: wanted-search
version: 1.0.0
description: >
  원티드(wanted.co.kr)에서 채용공고를 검색하고 상세 정보를 조회할 때 사용한다.
  채용공고, 구인, 이직, 신입 공채, 개발자 채용, 원티드 검색, Wanted jobs,
  job listings, job search, hiring, career opportunities 요청에 적용한다.
context: fork
enabled: true
allowed-tools: Bash(bun run .agents/skills/wanted-search/cli/src/cli.ts *)
---

# 원티드 채용공고 검색

원티드의 검색 결과와 공고 상세를 조회하는 CLI입니다. OpenAPI 자격 증명이 있으면 공식 API를 우선 사용합니다. 키가 없을 때는 기본적으로 `AUTH_REQUIRED`를 반환하며, 사용자가 `--unofficial` 또는 `WANTED_ALLOW_UNOFFICIAL=1`로 명시적으로 허용한 경우에만 공개 웹 JSON을 사용합니다.

## 개인 사용 전용 경고

⚠️ **개인 사용 전용** — `wanted.co.kr/robots.txt`는 CloudFront 403으로 정책을 확인하지 못했습니다. 키가 없는 공개 웹 JSON API는 비공식이며, 원티드 이용약관은 자동화 수단을 이용한 회원 데이터 수집 및 기술적 조치 우회를 제한합니다. 로그인/회원 데이터에 접근하지 말고, 공개 채용공고를 소량·저빈도로 개인 구직 확인에만 사용하세요. 공식 키가 없으면 기본 사용은 차단됩니다. 비공식 사용을 명시적으로 허용할 때만 `--unofficial` 플래그 또는 `WANTED_ALLOW_UNOFFICIAL=1` 환경변수를 설정하세요. 실행 시 기존 비공식 모드 경고를 stderr에 안내합니다. 공식 OpenAPI 사용을 우선 권장합니다.

## 명령

```bash
bun run .agents/skills/wanted-search/cli/src/cli.ts search -q "백엔드" --limit 5 --format table
bun run .agents/skills/wanted-search/cli/src/cli.ts detail 392946 --format plain
bun run .agents/skills/wanted-search/cli/src/cli.ts search -q "백엔드" --unofficial
WANTED_ALLOW_UNOFFICIAL=1 bun run .agents/skills/wanted-search/cli/src/cli.ts detail 392946
```

- `search`: `-q, --query` 필수, `--page` 1부터 시작, `--limit` 1~100, `--location`, `--career 신입|경력`, `--sort`, `--format json|table|plain`
- `detail <id|url>`: 숫자 공고 ID 또는 `wanted.co.kr/wd/<id>` URL, `--format json|plain`
- 출력 공통 필드: `id`, `title`, `company`, `location`, `posted_at`, `deadline`, `deadline_text`, `deadline_status`, `career`, `education`, `employment_type`, `url`, `source`. 연차 범위(`annual_from`, `annual_to`), 태그, 추천 보상금도 있으면 포함합니다.
- 마감 필드는 ISO 날짜인 `deadline`과 표시 문구인 `deadline_text`를 구분합니다. 확인된 날짜는 `deadline_status: "fixed"`, 비공식 웹 응답의 명시적 `due_time: null`(공개 공고 화면의 `상시채용` 표기와 대조됨)이나 원천의 상시·수시 문구는 `deadline: null`, `deadline_text: "상시"` 또는 원문 문구, `deadline_status: "rolling"`으로 출력합니다. 마감 필드가 없거나 공식 API의 의미를 확인하지 못한 null은 `deadline: null`, `deadline_text: "마감일 미표기"`, `deadline_status: "unknown"`입니다.
- 세 포털의 마감 필드 의미 비교:

  | 포털 | `deadline` | `deadline_text` | `deadline_status` |
  |---|---|---|---|
  | 원티드 | 확인된 고정 마감의 ISO 날짜, 아니면 `null` | 원천 상시 문구 또는 검증된 비공식 웹 null의 `상시`; 불명확/누락은 `마감일 미표기` | `fixed`, `rolling`, `unknown`으로 명시 |
  | 사람인 | 카드에서 파싱한 ISO 날짜; 상시채용·채용시는 `null` | 상시채용·채용시 등 원문 문구 보존 | 별도 필드 없음; 날짜면 fixed, 비확정 문구면 rolling으로 해석 가능 |
  | 잡코리아 | 검색 보강 또는 상세에서 얻은 ISO 날짜; 미확인은 `null` | 비확정 마감 표기가 있으면 원문 보존 | 별도 필드 없음; `valid_through`는 별도 원천 필드이며 비확정 문구를 대체하지 않음 |

  원천 필드가 누락된 경우와 null의 의미를 확인하지 못한 경우는 상시채용으로 추정하지 않습니다. 사람인/잡코리아의 필드 처리와 검색 보강 동작은 각 포털 스킬 문서를 따릅니다.
- 상세 JSON에는 지원서 작성에 필요한 `sections` 객체가 있으며 `main_tasks`, `requirements`, `preferred_points`, `benefits`를 별도 보존합니다.
- 인증은 `WANTED_CLIENT_ID`, `WANTED_CLIENT_SECRET` 환경변수로만 설정합니다. 비밀값을 명령행이나 저장소에 넣지 마세요.
- 공식 키 발급은 [Wanted OpenAPI 포털](https://openapi.wanted.jobs/)에서 연동을 신청하세요. `--unofficial` 및 `WANTED_ALLOW_UNOFFICIAL=1`은 robots 정책 미확인인 비공식 웹 JSON을 개인 구직 용도로 호출하도록 명시적으로 허용합니다. 권한을 부여하지 않으려면 공고 URL이나 본문을 `/apply-kr`에 직접 붙여넣으세요.
- 오류는 stderr JSON과 종료 코드 1로 반환합니다.

## 요청 수

`search`와 `detail` JSON은 `meta.http_requests`에 재시도를 포함한 실제 HTTP fetch 수를 담습니다. table/plain 출력은 stderr에 `http_requests: N`을 표시합니다. 검색과 상세는 기본 1회 요청이며 429/5xx 재시도는 설정된 재시도 한도 안에서 계측값에 포함됩니다.

## 출처 / 제한

OpenAPI 인증 및 endpoint 개요는 [url-reference.md](url-reference.md)를 확인하세요. 키가 없는 현재 환경에서 공식 OpenAPI 경로는 **미검증(키 없음)** 상태입니다. 공개 API의 정책 또한 robots.txt 차단으로 **미확인**입니다.

`detail <id|url> --save <dir>`는 상세 JSON과 설명 섹션을 `<dir>/job_posting.json`, `<dir>/job_posting.md`에 저장합니다. 기존 파일은 기본적으로 보호하며 덮어쓰려면 `--force`를 지정합니다. `--save-under BASE`는 회사_직무 폴더를 만들어 저장하며, 같은 공고 ID면 재사용하고 다른 ID면 폴더명 끝에 ID를 붙입니다. JSON meta에는 `saved_dir`가 포함되고 재사용 시 `reused: true`가 포함됩니다.
