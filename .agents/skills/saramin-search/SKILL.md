---
name: saramin-search
version: 1.0.0
description: >
  사람인(saramin.co.kr) 채용공고 검색 및 상세 조회에 사용합니다. 채용공고, 구인, 이직,
  신입 공채, 개발자 채용 검색과 Saramin job search triggers를 지원합니다.
context: fork
enabled: true
allowed-tools: Bash(bun run .agents/skills/saramin-search/cli/src/cli.ts *)
---

# 사람인 채용공고 검색

사람인 CLI로 공개 채용공고를 저빈도로 조회합니다.

## ⚠️ 개인 사용 전용

개인 구직 목적으로만 사용하고 요청량을 낮게 유지하세요. 대량 수집, 상업적 이용, 재배포는 하지 마세요. 사람인 기업회원 약관 제12조 개정 공지에는 회사의 사전 동의 없는 API 통신 및 크롤링 금지 조항이 안내되어 있습니다. 공개 검색 페이지 자동 조회가 약관상 허용되는지 일반 이용자 약관에서 명시적으로 확인하지 못했으므로, 공개 웹 모드는 개인적 보조 조회로 제한하세요. 공식 API는 access key 발급 및 일일 호출 제한(최대 500회), 서비스 재판매·이용 대가 금지 등 공식 주의사항을 따릅니다.

## 명령

```bash
bun run .agents/skills/saramin-search/cli/src/cli.ts search -q "백엔드" --limit 5 --format table
bun run .agents/skills/saramin-search/cli/src/cli.ts search -q "데이터 엔지니어" --page 2 --format json
bun run .agents/skills/saramin-search/cli/src/cli.ts detail 27614114 --format plain
```

`search`는 `--query/-q` 필수이며 `--page`, `--limit`(1~110), `--location/-l`(사람인 지역 코드), `--career`, `--sort`, `--format json|table|plain`을 받습니다. 검색 카드의 마감일은 Asia/Seoul 날짜 기준으로 연도를 추론하며, 오늘보다 앞선 월/일은 다음 해로 처리합니다. 오늘마감/내일마감은 서울 날짜를 기준으로 ISO 날짜로 바꿉니다. 상시채용·채용시는 `deadline: null`과 원문 `deadline_text`를 출력합니다. `detail`은 공고 ID 또는 `rec_idx` URL을 받고, relay 요약 페이지 및 `relay/view-detail` 본문 페이지를 읽습니다. 마감·지역·경력·학력·고용형태는 두 응답에서 직접 파싱하며 기본 검색 보강은 하지 않습니다. 상세 응답에 필드가 없으면 null과 `metadata_missing_reasons`를 반환합니다. 검색 보강이 필요할 때만 `detail <id> --enrich`를 지정하세요. 본문이 이미지뿐이면 `image_only: true`를 표시합니다. JSON 결과는 `meta.source`와 각 공고의 `source`를 `saramin-api` 또는 `saramin-web`으로 표시합니다.

경력 조건의 서버 요청과 결과 허용 범위는 다음과 같습니다. 서버 필터만으로 광고 등 일부 카드가 섞일 수 있어 결과를 `career` 값으로 다시 거릅니다.

| `--career` | 공개 검색 서버 파라미터 | 결과에 허용하는 `career` 값 |
|---|---|---|
| `신입` | `exp_cd=1`, `exp_none=y` | `신입`, `신입·경력`/`신입/경력`, `경력무관` |
| `경력` | `exp_cd=2`, `exp_none=y` | `경력 N년`(범위·↑ 포함), `신입·경력`/`신입/경력`, `경력무관`; 순수 `신입` 제외 |

두 필터는 같은 혼합·무관 표기를 허용하고, 각각 신입 단독 또는 경력 단독 조건을 추가합니다. 이 후처리는 유료 광고 카드에도 적용됩니다. 따라서 검색 한 번은 검색 페이지 요청 1회입니다. 키 없는 상세는 기본 2회(요약 + 본문)이며 `--enrich` 지정 시에만 검색 1회가 추가되어 3회입니다. 키 설정 상세는 요약·본문·공식 API 요청 3회입니다. 여기에 재시도 횟수는 고정 상한이 아니며 실제 요청 수로 계측합니다. 정책 비교: Saramin 상세는 기본 보강을 끄고 `--enrich`에서만 추가 호출합니다. JobKorea 검색은 반대로 기본 보강을 켜고 `--no-enrich`에서 끄므로 두 포털의 옵션 기본값이 서로 다릅니다.

## 요청 수

`search`와 `detail` JSON은 `meta.http_requests`에 재시도를 포함한 실제 HTTP fetch 수를 담습니다. table/plain 출력은 stderr에 `http_requests: N`을 표시합니다. 검색은 기본 1회, 키 없는 detail은 기본 2회이며 `--enrich` 시 검색 요청이 더해집니다. 공식 API 키가 설정된 detail은 요약·본문·API 요청이 각 1회입니다.

## 데이터 출처

`SARAMIN_ACCESS_KEY`가 있으면 공식 API를 우선 사용합니다. 키는 환경변수로만 전달하고 저장소에 기록하지 마세요. 키가 없으면 robots.txt에서 허용을 확인한 공개 검색 페이지와 relay 상세 페이지를 조회합니다. 로그인 페이지나 robots.txt에서 금지된 경로는 사용하지 않습니다. 응답은 stderr JSON 오류와 종료 코드 1로 보고합니다.

`detail <id> --save <dir>`는 상세 JSON과 본문을 `<dir>/job_posting.json`, `<dir>/job_posting.md`에 저장합니다. 기존 파일은 기본적으로 보호하며 덮어쓰려면 `--force`를 지정합니다. `--save-under BASE`는 회사_직무 폴더를 만들어 저장하며, 같은 공고 ID면 재사용하고 다른 ID면 폴더명 끝에 ID를 붙입니다. JSON meta에는 `saved_dir`가 포함되고 재사용 시 `reused: true`가 포함됩니다.
