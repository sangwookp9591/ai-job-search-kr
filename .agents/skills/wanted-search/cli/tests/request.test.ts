import { afterEach, describe, expect, test } from "bun:test"
import { apiFetch } from "../src/helpers.js"
const oldFetch = globalThis.fetch
const oldTimer = globalThis.setTimeout
afterEach(() => { globalThis.fetch = oldFetch; globalThis.setTimeout = oldTimer })
describe("request behavior", () => {
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
