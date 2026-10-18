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

`search`는 `--query/-q` 필수이며 `--page`, `--limit`(1~110), `--location/-l`(사람인 지역 코드), `--career`, `--sort`, `--format json|table|plain`을 받습니다. 검색 카드의 마감일은 Asia/Seoul 날짜 기준으로 연도를 추론하며, 오늘보다 앞선 월/일은 다음 해로 처리합니다. 오늘마감/내일마감은 서울 날짜를 기준으로 ISO 날짜로 바꿉니다. 상시채용·채용시는 `deadline: null`과 원문 `deadline_text`를 출력합니다. `detail`은 공고 ID 또는 `rec_idx` URL을 받고, relay 요약 페이지 및 `relay/view-detail` 본문 페이지를 읽습니다. 제목 기반 검색으로 상세의 지역·경력·학력·고용형태를 보충합니다. 본문이 이미지뿐이면 `image_only: true`를 표시합니다. JSON 결과는 `meta.source`와 각 공고의 `source`를 `saramin-api` 또는 `saramin-web`으로 표시합니다.

## 데이터 출처

`SARAMIN_ACCESS_KEY`가 있으면 공식 API를 우선 사용합니다. 키는 환경변수로만 전달하고 저장소에 기록하지 마세요. 키가 없으면 robots.txt에서 허용을 확인한 공개 검색 페이지와 relay 상세 페이지를 조회합니다. 로그인 페이지나 robots.txt에서 금지된 경로는 사용하지 않습니다. 응답은 stderr JSON 오류와 종료 코드 1로 보고합니다.
