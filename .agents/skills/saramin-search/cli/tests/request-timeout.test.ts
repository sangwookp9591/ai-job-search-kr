import { expect, test } from "bun:test"
import { fetchText } from "../src/helpers.js"
test("요청에 15초 timeout을 지정한다", async () => { const old = globalThis.fetch; let signal: AbortSignal | undefined; globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => { signal = init?.signal as AbortSignal; return new Response("ok") }) as unknown as typeof fetch; try { expect(await fetchText("https://example.test")).toBe("ok"); expect(signal).toBeDefined(); expect(signal?.aborted).toBe(false) } finally { globalThis.fetch = old } })
