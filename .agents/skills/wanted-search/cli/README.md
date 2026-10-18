# Wanted Search CLI

원티드 채용공고를 검색하고 상세 설명을 읽는 Bun CLI입니다.

```bash
bun run src/cli.ts search -q "백엔드" --limit 5 --format table
bun run src/cli.ts detail 392946 --format plain
```

`WANTED_CLIENT_ID`와 `WANTED_CLIENT_SECRET`가 모두 있으면 OpenAPI 모드를 사용합니다. 없으면 공개 웹 JSON API를 호출하며, 개인 사용 전용 안내를 stderr에 출력합니다. 테스트는 저장된 응답 fixture 기반입니다.
