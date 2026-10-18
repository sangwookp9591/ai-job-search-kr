# jobkorea-cli

Bun 기반 공개 구인공고 검색 도구입니다. `search -q "백엔드" --limit 5 --format table`, `detail 50135552 --format plain`을 사용합니다. 플래그: search `--query/-q`, `--page`, `--limit`, `--location/-l`, `--career`, `--sort`, `--format`; detail은 ID 또는 잡코리아 공고 URL과 `--format json|plain`을 받습니다.
