import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { searchZip, clearCache, SearchError } from "../lib/search.js";
import { lookupZip } from "../lib/zip.js";

beforeEach(() => clearCache());

test("zip lookup validates format and existence", () => {
  assert.equal(lookupZip("10001").city, "New York");
  assert.equal(lookupZip("1234"), null);
  assert.equal(lookupZip("abcde"), null);
  assert.equal(lookupZip("00000"), null);
});

test("unknown zip raises a friendly error", async () => {
  await assert.rejects(searchZip("00000"), (e) => e instanceof SearchError && e.code === "unknown_zip");
});

test("demo mode returns three core cards with no repeated places", async () => {
  const r = await searchZip("94103");
  assert.equal(r.demo, true);
  assert.deepEqual(r.cards.map((c) => c.id), ["sights", "restaurants", "gems"]);
  const ids = r.cards.flatMap((c) => c.places.map((p) => p.id));
  assert.equal(new Set(ids).size, ids.length);
  for (const c of r.cards) assert.ok(c.places.length <= 3);
});

test("more group returns the five extra cards", async () => {
  const r = await searchZip("94103", { group: "more" });
  assert.deepEqual(r.cards.map((c) => c.id), ["coffee", "outdoors", "kids", "photo", "nightlife"]);
});

test("live mode calls Google with the key and caches the result", async () => {
  let calls = 0;
  const fetchImpl = async (url, opts) => {
    calls++;
    assert.equal(opts.headers["X-Goog-Api-Key"], "test-key");
    const body = JSON.parse(opts.body);
    assert.match(body.textQuery, /near 10001$/);
    const tag = body.textQuery.split(" ")[1];
    const places = [4.8, 4.6, 4.9, 4.7].map((rating, i) => ({
      id: `${tag}-${i}`,
      displayName: { text: `${tag} ${i}` },
      rating,
      userRatingCount: [3000, 150, 40, 800][i],
      googleMapsUri: "https://maps.google.com/?cid=1",
      location: { latitude: 40.75 + i * 0.001, longitude: -73.99 },
    }));
    return { ok: true, json: async () => ({ places }) };
  };
  const r1 = await searchZip("10001", { apiKey: "test-key", fetchImpl });
  assert.equal(r1.demo, false);
  assert.equal(calls, 2); // sights + restaurants; gems are derived
  assert.ok(r1.cards[2].places.length > 0, "hidden gems found from the pool");
  const r2 = await searchZip("10001", { apiKey: "test-key", fetchImpl });
  assert.equal(calls, 2);
  assert.equal(r2.cached, true);
});

test("places far outside the area are dropped", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({
      places: [{ id: "far", displayName: { text: "Far" }, rating: 4.9, userRatingCount: 5000,
        location: { latitude: 41.5, longitude: -73.99 } }],
    }),
  });
  const r = await searchZip("10001", { apiKey: "k", fetchImpl });
  assert.equal(r.cards[0].places.length, 0);
});
