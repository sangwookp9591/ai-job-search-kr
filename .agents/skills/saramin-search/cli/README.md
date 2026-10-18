# saramin-cli

```bash
bun install
bun run typecheck
bun test
bun run src/cli.ts search -q "백엔드" --limit 5 --format table
bun run src/cli.ts detail 27614114 --format plain
```

`SARAMIN_ACCESS_KEY` 설정 시 공식 API를, 없으면 robots 허용 공개 검색/상세 페이지를 사용합니다. API 상세는 `id` 파라미터로 요청합니다. 요청은 15초 timeout과 429/5xx exponential retry를 사용합니다.
