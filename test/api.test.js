// Tests for the /api/search handler: status codes, messages and cache headers.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import handler from "../api/search.js";
import { clearCache } from "../lib/search.js";

beforeEach(() => {
  clearCache();
  delete process.env.GOOGLE_MAPS_API_KEY;
});

async function call(url, method = "GET") {
  const headers = {};
  let body = "";
  const res = {
    statusCode: 200,
    setHeader: (k, v) => (headers[k.toLowerCase()] = v),
    end: (b = "") => (body = b),
  };
  await handler({ url, method }, res);
  return { status: res.statusCode, headers, json: JSON.parse(body) };
}

test("rejects a malformed zip with 400", async () => {
  for (const zip of ["", "123", "abcde", "123456", "10001-1234"]) {
    const r = await call(`/api/search?zip=${encodeURIComponent(zip)}`);
    assert.equal(r.status, 400, zip);
    assert.equal(r.json.error, "invalid_zip");
  }
});

test("unknown zip gives 404 with a friendly message", async () => {
  const r = await call("/api/search?zip=00000");
  assert.equal(r.status, 404);
  assert.match(r.json.message, /couldn't find/);
});

test("unknown group gives 400", async () => {
  const r = await call("/api/search?zip=10001&group=all");
  assert.equal(r.status, 400);
});

test("non-GET requests are refused", async () => {
  const r = await call("/api/search?zip=10001", "POST");
  assert.equal(r.status, 405);
});

test("demo results are never CDN-cached (they'd outlive adding the API key)", async () => {
  const r = await call("/api/search?zip=10001");
  assert.equal(r.status, 200);
  assert.equal(r.json.demo, true);
  assert.equal(r.headers["cache-control"], "no-store");
});

test("spaces around the zip are tolerated", async () => {
  const r = await call("/api/search?zip=%2010001%20");
  assert.equal(r.status, 200);
  assert.equal(r.json.zip, "10001");
});

function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => (globalThis.fetch = original));
}

test("complete live results are CDN-cached for a day", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "k";
  const ok = async () => ({ ok: true, json: async () => ({ places: [] }) });
  await withFetch(ok, async () => {
    const r = await call("/api/search?zip=10001");
    assert.equal(r.status, 200);
    assert.equal(r.json.demo, false);
    assert.match(r.headers["cache-control"], /s-maxage=86400/);
  });
});

test("Google failing everywhere gives 502; Google rate-limiting gives 503", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "k";
  await withFetch(async () => ({ ok: false, status: 500, text: async () => "x" }), async () => {
    const r = await call("/api/search?zip=10001");
    assert.equal(r.status, 502);
    assert.equal(r.json.error, "upstream");
  });
  clearCache();
  await withFetch(async () => ({ ok: false, status: 429, text: async () => "x" }), async () => {
    const r = await call("/api/search?zip=10002");
    assert.equal(r.status, 503);
  });
});
