import { expect, test } from "bun:test"
import { fetchText } from "../src/helpers.js"
test("429 후 재시도해 응답을 받는다", async () => { const old = globalThis.fetch; let calls = 0; globalThis.fetch = (async () => { calls++; return calls === 1 ? new Response("busy", { status: 429 }) : new Response("ok") }) as unknown as typeof fetch; try { expect(await fetchText("https://example.test")).toBe("ok"); expect(calls).toBe(2) } finally { globalThis.fetch = old } })
