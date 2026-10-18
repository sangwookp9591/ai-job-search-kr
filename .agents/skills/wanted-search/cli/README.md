# Wanted Search CLI

원티드 채용공고를 검색하고 상세 설명을 읽는 Bun CLI입니다.

```bash
bun run src/cli.ts search -q "백엔드" --limit 5 --format table
bun run src/cli.ts detail 392946 --format plain
```

`WANTED_CLIENT_ID`와 `WANTED_CLIENT_SECRET`를 설정하면 공식 OpenAPI를 사용합니다. 키가 없으면 기본적으로 `AUTH_REQUIRED` 오류를 반환합니다. 비공식 웹 JSON을 사용하려면 명령에 `--unofficial`을 주거나 `WANTED_ALLOW_UNOFFICIAL=1`을 설정하세요. 이 경로는 개인 사용 전용이며 robots.txt 정책이 확인되지 않았습니다. 실행 시 기존 비공식 모드 경고를 stderr에 출력합니다. 대신 공고 URL이나 본문을 `/apply-kr`에 직접 붙여넣을 수 있습니다.

```bash
WANTED_CLIENT_ID="..." WANTED_CLIENT_SECRET="..." bun run src/cli.ts search -q "백엔드"
bun run src/cli.ts search -q "백엔드" --unofficial
WANTED_ALLOW_UNOFFICIAL=1 bun run src/cli.ts detail 392946
```

키는 [공식 Wanted OpenAPI 포털](https://openapi.wanted.jobs/)에서 연동을 신청해 발급받고 환경변수로만 설정하세요. 테스트는 저장된 응답 fixture 기반입니다.
