import { expect, test } from "bun:test"

async function runCLI(args: string[]) {
  const proc = Bun.spawn(["bun", "run", "src/cli.ts", ...args], {
    cwd: new URL("..", import.meta.url).pathname,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

test("kebab-case and camelCase options normalize before validation", async () => {
  for (const flags of [
    ["--enrich-limit=0", "--career=신입", "--no-enrich"],
    ["--enrichLimit=0", "--career=신입", "--enrich=false"],
  ]) {
    const result = await runCLI(["search", "-q", "백엔드", ...flags, "--unknown"])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("UNKNOWN_FLAG")
    expect(JSON.parse(result.stderr).error).toContain("--unknown")
  }
}, 15000)

test("unknown options still return UNKNOWN_FLAG", async () => {
  const result = await runCLI(["search", "-q", "백엔드", "--unknown"])
  expect(result.exitCode).toBe(1)
  expect(JSON.parse(result.stderr).code).toBe("UNKNOWN_FLAG")
}, 15000)
