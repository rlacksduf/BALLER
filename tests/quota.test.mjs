import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("한도 차단은 재시작 후에도 외부 요청을 0회로 유지하고 캐시는 재사용한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "baller-quota-"));
  const original = globalThis.fetch,
    env = process.env.BALLER_CACHE_FILE,
    disabled = process.env.BALLER_DB_DISABLED;
  process.env.BALLER_DB_DISABLED = "true";
  process.env.BALLER_CACHE_FILE = join(directory, "cache.json");
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return Response.json({ data: [{ id: 1 }] });
  };
  try {
    const first = await import("../server/highlightly.mjs?quota-test-first");
    await first.queryHighlightly("/players?name=Test", "dummy-cache-key");
    assert.equal(calls, 1);
    first.blockLiveRequests("dummy-cache-key");
    const restarted =
      await import("../server/highlightly.mjs?quota-test-restarted");
    const cached = await restarted.queryHighlightly(
      "/players?name=Test",
      "dummy-cache-key",
    );
    assert.equal(cached.status, 200);
    assert.equal(calls, 1);
    const blocked = await restarted.queryHighlightly(
      "/players?name=NeverRequested",
      "dummy-cache-key",
    );
    assert.equal(blocked.status, 429);
    assert.equal(calls, 1);
    assert.ok(
      restarted.getQuotaStatus("dummy-cache-key").blockedUntil > Date.now(),
    );
    restarted.resumeLiveRequests("dummy-cache-key");
    assert.equal(restarted.getQuotaStatus("dummy-cache-key").blockedUntil, 0);
  } finally {
    globalThis.fetch = original;
    if (disabled === undefined) delete process.env.BALLER_DB_DISABLED;
    else process.env.BALLER_DB_DISABLED = disabled;
    if (env === undefined) delete process.env.BALLER_CACHE_FILE;
    else process.env.BALLER_CACHE_FILE = env;
    await rm(directory, { recursive: true, force: true });
  }
});
