import { createCLI } from "@bunli/core"
import { writeError } from "./helpers.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"
const cli = await createCLI({ name: "saramin-cli", version: "0.1.0", description: "사람인 채용공고 검색 CLI" })
const commands = [search, detail]
for (const command of commands) cli.command(command)
const kebabToCamel = (name: string) => name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
const normalizeFlags = (argv: string[]) => { let stopped = false; return argv.map((arg) => {
  if (arg === "--") { stopped = true; return arg }
  if (stopped || !arg.startsWith("--")) return arg
  const [name, ...value] = arg.slice(2).split("=")
  if (name.startsWith("no-")) return `--${kebabToCamel(name.slice(3))}=false`
  return `--${kebabToCamel(name)}${value.length ? `=${value.join("=")}` : ""}`
}) }
process.argv = [...process.argv.slice(0, 2), ...normalizeFlags(process.argv.slice(2))]
const args = process.argv.slice(2), command = commands.find(item => (item as { name?: string }).name === args[0])
if (command) { const opts = (command as { options?: Record<string, { short?: string }> }).options ?? {}; const known = new Set([...Object.keys(opts), "help", "version"]), shorts = new Set(Object.values(opts).map(o => o.short).filter(Boolean).concat("h", "v") as string[]); for (const arg of args.slice(1)) { if (arg === "--") break; if (arg.startsWith("--") && !known.has(arg.slice(2).split("=")[0])) { writeError(`알 수 없는 플래그: ${arg}`, "UNKNOWN_FLAG"); process.exit(1) } if (/^-[^-]/.test(arg) && !shorts.has(arg.slice(1).split("=")[0])) { writeError(`알 수 없는 플래그: ${arg}`, "UNKNOWN_FLAG"); process.exit(1) } } }
await cli.run()
