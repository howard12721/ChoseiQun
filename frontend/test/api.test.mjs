import assert from "node:assert/strict";
import test from "node:test";
import { buildAvailabilityRequest } from "../src/features/availability/request.ts";
import { requestJson } from "../src/shared/api/http.ts";

test("feature API owns availability URL method and payload", () => {
  const request = buildAvailabilityRequest("poll1234", { "2026-07-20": "YES" });

  assert.equal(request.url, "/api/polls/poll1234/availability");
  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(request.init.body), {
    responses: { "2026-07-20": "YES" },
  });
});

test("requestJson preserves caller headers while adding JSON content type", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let capturedHeaders;
  globalThis.fetch = async (_url, init) => {
    capturedHeaders = init.headers;
    return { ok: true, json: async () => ({ ok: true }) };
  };

  await requestJson("/api/example", {
    method: "POST",
    headers: { "X-Test": "kept" },
    body: "{}",
  });

  assert.equal(capturedHeaders.get("X-Test"), "kept");
  assert.equal(capturedHeaders.get("Content-Type"), "application/json");
});
