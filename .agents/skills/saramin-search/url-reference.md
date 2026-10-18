# 사람인 URL 및 응답 참고

## 공식 채용검색 API

- 가이드: https://oapi.saramin.co.kr/guide/job-search (2026-10-18 확인)
- 검색 및 ID 상세: `GET https://oapi.saramin.co.kr/job-search`
- JSON: 요청 헤더 `Accept: application/json`; 필수 query `access-key`.
- 검색: `keywords`, `start`(0 기반), `count`(기본 10, 최대 110), `sort`(`pd`, `pa`, `ud`, `ua`, `da`, `dd`, `rc`, `ac`), `loc_cd`/`loc_mcd`/`loc_bcd`, `job_type`, `edu_lv`, `fields` 등을 제공.
- 상세: 같은 URI에 `id=<공고번호>`.
- 일시 필드가 필요하면 `fields=posting-date expiration-date` 지정. `jobs` 아래 `count`, `start`, `total`, `job` 배열이며 공고는 `id`, `url`, `active`, `company.detail.name`, `position.title/location/job-type`, `experience-level`, `required-education-level`, `posting-date`, `expiration-date` 등을 담음.
- 공식 예시에는 API 오류 객체 `{code,message}` 및 에러 코드 1(키 없음), 2(키 무효), 3(파라미터), 4(일일 한도), 99가 안내됨.
- API 개요 및 주의사항: https://oapi.saramin.co.kr/guide/info, https://oapi.saramin.co.kr/caution (일일 최대 호출 500건, key 비공개 유지 등).
- 현 환경에는 `SARAMIN_ACCESS_KEY`가 없어 라이브 검증하지 못함. 테스트 fixture는 공식 가이드가 보여주는 필드 구조를 반영한 합성 데이터이며 **미검증(키 없음)**.

## 공개 웹 폴백

- 검색: `https://www.saramin.co.kr/zf_user/search/recruit?searchword=<검색어>`
- 상세 요약/메타데이터: `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=<ID>`
- 상세 본문: `https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=<ID>` — 실제 relay 페이지 HTML의 `jv_options.requestUrl`은 `view-ajax`이지만 이 ajax 엔드포인트는 호출에 필요한 컨텍스트가 문서화되지 않았고 직접 확인 결과 오류 안내 페이지를 반환해 사용하지 않음. `view-detail`은 공고별 본문 HTML을 직접 반환함.
- URL은 사람인 relay URL에서 `rec_idx`만 남기며 `view_type`, `location`, `searchword`, `searchType`, `paid_fl`, `search_uuid` 추적/검색 파라미터는 제거함.
- robots 검사 도구: `python3 tools/robots_check.py <URL>` (exit 0 허용, exit 1 금지 또는 미확인).
- 2026-10-18 직접 확인: 검색 경로 및 `/zf_user/jobs/relay/view?rec_idx=123`, `/zf_user/jobs/view?rec_idx=123`은 `ALLOWED - robots.txt permits this path`; API endpoint는 robots.txt 미게시로 허용 판정. 사용자 조사에서 robots 정책에 금지 경로(`/zf_user/jobs/view/etc`, `/zf_user/recruit/view/`, `/recruit/recruit_view.php`, `/zf_user/recruit/recruit-posting/`)와 GPTBot 전면 차단이 확인되었으므로 이 경로들은 요청하지 않음.
- 사람인 기업회원 약관 개정 공지: https://www.saramin.co.kr/zf_user/help/live/view?idx=109708&listType=notice&nomo=1 — 제12조에 사전 동의 없는 API 통신 및 크롤링 금지 조항 신설을 공지. 일반 회원약관 자동수집 조항의 적용 여부는 확인되지 않음.
- Search card selectors confirmed from live HTML: `.item_recruit`, `.job_tit`, `.job_date .date`, `.job_condition span`, `.corp_name`; `data-data_layer`/link `paid_fl` carries paid-ad state. Deadline `M/D` values use current year unless already past, then next year; `오늘마감` and `내일마감` use the current local date; `상시채용`/`채용시` retain the source text and have null ISO deadline.
- Live check for `rec_idx=55210151`: summary meta description provides company, career, education, and exact deadline; its `view-detail` response contains the posting body under `.user_content`. Search by the exact title is also used to fill location/employment metadata absent from the relay summary.
- 2026-10-18 robots check results: `/zf_user/jobs/relay/view?rec_idx=55210151` and `/zf_user/jobs/relay/view-detail?rec_idx=55210151` both `ALLOWED - robots.txt permits this path`; `/zf_user/jobs/relay/view-ajax?rec_idx=55210151` is also robots-allowed but not used due response/context issue. The old `/zf_user/jobs/view/etc` disallow path remains unused.
