import { expect, test } from "bun:test"
import { fetchText, getHttpRequests, resetHttpRequests } from "../src/helpers.js"
test("429 재시도를 포함한 실제 fetch 요청 수를 센다", async () => { const old = globalThis.fetch; let calls = 0; resetHttpRequests(); globalThis.fetch = (async () => { calls++; return calls === 1 ? new Response("busy", { status: 429 }) : new Response("ok") }) as unknown as typeof fetch; try { expect(await fetchText("https://example.test")).toBe("ok"); expect(calls).toBe(2); expect(getHttpRequests()).toBe(2) } finally { globalThis.fetch = old } })
