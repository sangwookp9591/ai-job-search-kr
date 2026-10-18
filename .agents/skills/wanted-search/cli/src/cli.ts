import { createCLI } from "@bunli/core"
import { writeError } from "./helpers.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"
const cli = await createCLI({ name: "wanted-cli", version: "1.0.0", description: "원티드 채용공고 검색" })
const commands = [search, detail]
for (const command of commands) cli.command(command)
const argv = process.argv.slice(2)
const invoked = commands.find((c) => (c as { name?: string }).name === argv[0])
if (invoked) {
  const options = (invoked as { options?: Record<string, { short?: string } | undefined> }).options ?? {}
  const known = new Set([...Object.keys(options), "help", "version"])
  const shorts = new Set(Object.values(options).map((o) => o?.short).filter((s): s is string => typeof s === "string").concat("h", "v"))
  for (const token of argv.slice(1)) {
    if (token === "--") break
    if (token.startsWith("--") && !known.has(token.slice(2).split("=")[0])) { writeError(`unknown flag ${token.split("=")[0]} for '${argv[0]}'`, "UNKNOWN_FLAG"); process.exit(1) }
    if (token.startsWith("-") && token !== "-" && !token.startsWith("--") && !shorts.has(token.slice(1).split("=")[0])) { writeError(`unknown flag ${token}`, "UNKNOWN_FLAG"); process.exit(1) }
  }
}
await cli.run()
