# 잡코리아 URL 및 정책 참조

확인일: 2026-10-18 (검색/상세 공개 페이지), robots 정책 2026-08-21.

- 검색: `https://www.jobkorea.co.kr/Search/?stext=<검색어>&Page=<페이지>`. 서버 렌더 HTML에 Next.js RSC 스트림(`self.__next_f.push`)과 카드 링크가 포함되어 있어 공개 HTML 링크를 파싱한다. 시험 검색 백엔드에서 공고 URL `/Recruit/GI_Read/<숫자>` 확인.
- 상세: `https://www.jobkorea.co.kr/Recruit/GI_Read/<id>`. HTML meta description은 경력·학력·마감일 요약을 제공할 수 있으며, 본문은 Next.js 서버 렌더 HTML에 포함된다.
- robots.txt: `https://www.jobkorea.co.kr/robots.txt`. `tools/robots_check.py`가 검색 경로와 `/Recruit/GI_Read/123` 모두 허용 판정. 로그인/사용자/계정/기업 관리 경로 및 `/Recruit/JobList/SpaceClick`은 금지.
- 이용약관: https://www.jobkorea.co.kr/Service/Terms — WebFetch/웹 열기에서 본문을 가져오지 못해 자동수집 조항은 **미확인**. SKILL.md에도 확인 실패를 명시함.
- 공식 공개 API는 확인되지 않아 공개 페이지 HTML을 사용한다. HTML 구조 변경 시 파싱이 실패할 수 있다.
- 검색 카드의 현재 RSC HTML에서 지역(위치 아이콘 GrayChip), 경력(카드 하단 `text-gray700 text-typo-c1-13`), 프로모션 배지 `AD`를 파싱. 현재 카드 HTML에 마감일/학력/고용형태가 항상 포함되지는 않아 상위 최대 5개 결과의 공개 상세를 추가 조회해 메타 설명과 JSON-LD `JobPosting`의 `validThrough`, `datePosted`, `employmentType`, `jobLocation` 등으로 보완한다.
- 추적 파라미터가 붙어도 반환 URL은 정규형 `https://www.jobkorea.co.kr/Recruit/GI_Read/<id>`.
