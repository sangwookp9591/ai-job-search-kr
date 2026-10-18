---
name: jobkorea-search
version: 0.1.0
description: >
  한국 채용공고, 구인, 이직, 신입 공채, 개발자 채용을 검색하고 상세를 조회할 때 사용한다. 잡코리아(JobKorea) 공개 공고를 검색한다.
context: fork
enabled: true
allowed-tools: Bash(bun run .agents/skills/jobkorea-search/cli/src/cli.ts *)
---

# 잡코리아 공개 채용 검색

## ⚠️ 개인 사용 전용

공개 페이지를 저빈도로 개인 구직 목적으로만 조회하세요. 대량 수집·상업적 이용·재배포는 하지 마세요. **이용약관의 자동수집 조항은 미확인**입니다. 공식 이용약관 페이지가 WebFetch/웹 열기에서 접근되지 않아 조항 문구를 확인하지 못했습니다. robots.txt(2026-08-21 v3.0)는 Claude-User 등 사용자 대리 조회에 공개 콘텐츠를 허용하고 AI 학습 크롤러는 전면 차단합니다. 이 CLI는 학습 크롤러를 사칭하지 않으며 브라우저 호환 UA를 사용합니다.

## 사용

```bash
bun run .agents/skills/jobkorea-search/cli/src/cli.ts search -q "백엔드" --page 1 --limit 5 --format table
bun run .agents/skills/jobkorea-search/cli/src/cli.ts search -q "백엔드" --limit 5 --no-enrich
bun run .agents/skills/jobkorea-search/cli/src/cli.ts detail 50135552 --format plain
```

검색 옵션: `--query/-q`(필수), `--page`, `--limit`, `--format json|table|plain`, `--location/-l`, `--career 신입|경력|무관`, `--sort`, `--no-enrich`. `--career 신입`은 신입 지원 가능 공고를 요청하며, `신입`, `신입·경력`, `경력무관`만 결과에 남깁니다. `경력`은 신입 단독을 제외하고 경력 표기, `신입·경력`, 경력무관 공고를 남깁니다. `무관`은 경력무관 공고를 뜻합니다. 포털 검색의 경력 조건을 `careerType`으로 전달하고, 검색 결과의 `career` 값으로 다시 필터링합니다. 상세 옵션: `<id|url>`, `--format json|plain`. 상세는 공고 페이지 `GI_Read`와 본문 프레임 `GI_Read_Comt_Ifrm?Gno=<id>`를 각각 조회하므로 요청 2회가 발생합니다. 결과에는 id, title, company, location, posted_at, deadline, deadline_text, valid_through, career, education, employment_type, is_ad, url, source가 포함되며 상세에는 description, description_source, description_reason, apply_method, external_apply_url, external_apply_reason, image_only, image_urls가 추가됩니다. 본문 텍스트가 충분하면 구획별 줄바꿈을 보존해 `description_source: posting_body`로 표시합니다. 텍스트가 짧고 이미지가 있으면 `image_only: true`, 메타 요약은 `description_source: meta_summary`로 표시하고 `image_urls`와 짧은 본문 사유를 반환합니다. 프로토콜 상대 이미지 주소도 HTTPS 절대주소로 바꿉니다. 외부 홈페이지 링크는 `external_apply_url`과 `external_apply_reason`에 표시합니다. 모집요강 텍스트가 없을 때도 `description_reason`에 메타 요약만 제공되거나 본문이 이미지라는 사유를 표시합니다. 검색의 기본 상세 보강은 검색 요청 1회 후 상위 최대 5건에 대해 공고 및 프레임 요청을 각각 보내므로 총 최대 11회(검색 1회+상세 10회, 재시도 제외)입니다. 기본 모드는 이 상세 보강으로 마감 정보를 채울 수 있지만, `--no-enrich`는 추가 상세 요청을 모두 건너뜁니다. 라이브 검색 카드에는 마감 표기가 없을 수 있으며, 결과의 `deadline`과 `deadline_text`가 모두 비어 있으면 JSON `meta.deadline_unavailable_without_enrich: true`로 이 한계를 표시합니다. 날짜 표기 `D-N`, `오늘마감`, `~M/D(요일)`, `YYYY.MM.DD`는 파싱하고, 현재 연도의 날짜가 오늘보다 과거면 다음 해로 해석합니다. `상시채용`, `채용시 마감`, `수시` 등 비확정 마감 문구는 ISO deadline을 null로 두고 원문을 deadline_text에 보존합니다. JSON-LD `validThrough`가 있으면 별도 valid_through에만 두며 비확정 마감일을 덮어쓰지 않습니다. 오류는 stderr JSON과 종료 코드 1로 반환됩니다.

로그인 경로를 요청하지 않습니다. 시간초과는 15초이며 429/5xx에 한해 최대 4회 지수 백오프로 재시도합니다. 개인 계정 쿠키나 자격증명을 입력하지 마세요.
