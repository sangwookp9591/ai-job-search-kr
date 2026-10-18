import { afterEach, describe, expect, test } from "bun:test"
import { apiFetch, useOfficialApi } from "../src/helpers.js"
const oldFetch = globalThis.fetch
const oldTimer = globalThis.setTimeout
const oldEnv = { id: process.env.WANTED_CLIENT_ID, secret: process.env.WANTED_CLIENT_SECRET, allow: process.env.WANTED_ALLOW_UNOFFICIAL }
afterEach(() => {
  globalThis.fetch = oldFetch; globalThis.setTimeout = oldTimer
  for (const [key, value] of Object.entries({ WANTED_CLIENT_ID: oldEnv.id, WANTED_CLIENT_SECRET: oldEnv.secret, WANTED_ALLOW_UNOFFICIAL: oldEnv.allow })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})
describe("request behavior", () => {
  test("requires explicit opt-in when credentials are missing", () => {
    delete process.env.WANTED_CLIENT_ID; delete process.env.WANTED_CLIENT_SECRET; delete process.env.WANTED_ALLOW_UNOFFICIAL
    const exit = process.exit
    let status: number | undefined
    process.exit = ((code?: number) => { status = code; throw new Error("exit") }) as never
    try { expect(() => useOfficialApi(false)).toThrow("exit") } finally { process.exit = exit }
    expect(status).toBe(1)
  })
  test("allows web mode with the explicit flag", () => {
    delete process.env.WANTED_CLIENT_ID; delete process.env.WANTED_CLIENT_SECRET; delete process.env.WANTED_ALLOW_UNOFFICIAL
    expect(useOfficialApi(true)).toBe(false)
  })
  test("credentials select official mode even when unofficial is requested", () => {
    process.env.WANTED_CLIENT_ID = "test-id"; process.env.WANTED_CLIENT_SECRET = "test-secret"
    expect(useOfficialApi(true)).toBe(true)
  })
  test("environment opt-in allows web mode", () => {
    delete process.env.WANTED_CLIENT_ID; delete process.env.WANTED_CLIENT_SECRET; process.env.WANTED_ALLOW_UNOFFICIAL = "1"
    expect(useOfficialApi(false)).toBe(false)
  })
  test("sets timeout and User-Agent", async () => {
    let init: RequestInit | undefined
    globalThis.fetch = (async (_url: string | URL | Request, i?: RequestInit) => { init = i; return new Response("{}") }) as unknown as typeof fetch
    await apiFetch("https://example.test")
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(new Headers(init?.headers).get("user-agent")).toContain("wanted-search-cli")
  })
  test("retries a 429 before success", async () => {
    let n = 0
    globalThis.setTimeout = ((fn: (...args: any[]) => void) => oldTimer(fn, 0)) as typeof setTimeout
    globalThis.fetch = (async () => ++n === 1 ? new Response("", { status: 429 }) : new Response('{"ok":true}')) as unknown as typeof fetch
    expect(await apiFetch<{ok:boolean}>("https://example.test")).toEqual({ ok: true })
    expect(n).toBe(2)
  })
})
