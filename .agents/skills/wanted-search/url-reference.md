# Wanted URL/API reference

확인일: 2026-10-18

## 공식 Wanted OpenAPI (우선 경로)

- 포털: https://openapi.wanted.jobs/
- API V1 문서: https://openapi.wanted.jobs/api-docs/v1/
- API V2 문서: https://openapi.wanted.jobs/api-docs/v2/
- 공식 안내는 채용정보/회사정보 연동을 제공하며 Jobs는 포지션 목록, 정렬·연차·직원수·스킬·직군·직무 필터를 지원한다고 설명한다. 사용 전 client 등록 및 인증키 발급 신청이 필요하다. 신청 접수 후 3영업일 이내 발급 안내가 있다.
- 공식 문서 페이지는 동적 렌더링이라 경로별 세부 스키마를 이 실행 환경에서 텍스트로 추출할 수 없었다. CLI에서는 공개된 base URL, Jobs 리소스 구조(`/v1/jobs`, `/v1/jobs/{id}`), 지정 헤더 `wanted-client-id` 및 `wanted-client-secret`을 사용하도록 구성했다. 키 없는 환경이라 공식 호출은 미검증이다. 발급 안내는 문서에 Authorization 항목도 있으니 발급받은 연동 가이드와 다르면 공식 문서의 구체 사양에 맞춰 수정해야 한다.

## 공개 웹 JSON API (명시적 opt-in 필요)

- 검색: `https://www.wanted.co.kr/api/v4/jobs?country=kr&query={query}&limit={limit}&offset={offset}` (키가 없어도 `--unofficial` 또는 `WANTED_ALLOW_UNOFFICIAL=1`로 명시 허용한 경우에만)
- 상세: `https://www.wanted.co.kr/api/v4/jobs/{id}`
- 2026-10-18 소량 확인: 검색이 HTTP 200 및 `data[]`를 반환했고, 상세 응답은 `job.detail.main_tasks`, `requirements`, `preferred_points`, `benefits`를 제공했다. 키 없는 기본 호출은 `AUTH_REQUIRED`로 거부한다.
- `https://www.wanted.co.kr/robots.txt` 직접 요청은 CloudFront HTTP 403으로 내용을 읽을 수 없었다. 따라서 이 비공식 경로는 **정책 미확인**이다. 이용약관은 자동화된 수단(매크로·로봇·스파이더·스크래퍼 등)으로 회원가입/로그인 시도, 회원 정보 및 게시물 수집 등을 금지하고 기술적 조치 무력화도 금지한다. 본 CLI는 비로그인 공개 공고에 한해 저빈도 개인 확인 용도로만 사용한다.
- 마감 필드 실증(2026-10-18, 저볼륨): `GET /api/v4/jobs?country=kr&query=백엔드&limit=5&offset=0`와 `GET /api/v4/jobs?country=kr&query=마케팅&limit=5&offset=0`를 각각 1회 호출했다. 두 검색 결과 10건 중 고정일 3건은 `due_time` 날짜를 반환했고, 나머지 7건은 원천 `due_time: null`이었다. null 표본 `392951`은 `GET /api/v4/jobs/392951`에서도 `due_time: null`이었고, 공개 화면 [그로스 매니저 - 마케팅 파트](https://www.wanted.co.kr/wd/392951)의 `마감일` 영역은 `상시채용`으로 표시됐다. 따라서 확인된 비공식 웹 API의 명시적 `due_time: null`은 `deadline: null`, `deadline_text: "상시"`, `deadline_status: "rolling"`으로 정규화한다. 결과에 마감 원천 필드가 없거나 공식 API의 null 의미가 확인되지 않으면 `마감일 미표기`와 `unknown`을 쓴다. 두 검색, API 상세 1회, 공개 페이지 1회로 총 4회 요청했고, 검색 JSON의 `deadline` 또는 `deadline_text` 채움률은 10/10 (100%), 상태 분포는 `fixed` 3, `rolling` 7, `unknown` 0이었다.
- 이용약관: https://www.wanted.co.kr/terms
