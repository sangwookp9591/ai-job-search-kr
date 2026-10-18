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

test("kebab-case and camelCase detail options normalize before validation", async () => {
  for (const option of ["--save-under=/tmp/jobs", "--saveUnder=/tmp/jobs"]) {
    const result = await runCLI(["detail", "invalid", option])
    expect(result.exitCode).toBe(1)
    expect(JSON.parse(result.stderr).code).toBe("INVALID_JOB_ID")
    expect(JSON.parse(result.stderr).error).toContain("Wanted job ID")
  }
})

test("unknown options still return UNKNOWN_FLAG", async () => {
  const result = await runCLI(["detail", "392946", "--unknown"])
  expect(result.exitCode).toBe(1)
  expect(JSON.parse(result.stderr).code).toBe("UNKNOWN_FLAG")
})
