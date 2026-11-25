// Regression tests for bugs found in the first QA pass. Keep them: each one guards a real failure mode.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { searchZip, clearCache } from "../lib/search.js";
import { lookupZip } from "../lib/zip.js";
import { normalize, safeUrl } from "../lib/places.js";

beforeEach(() => clearCache());

// Builds a fake Google response. `spec` maps a word in the query to a list of [rating, reviews, milesNorth].
function fakeGoogle(spec, { failOn = [] } = {}) {
  const calls = [];
  const fetchImpl = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body);
    const word = Object.keys(spec).find((w) => body.textQuery.includes(w));
    if (failOn.some((w) => body.textQuery.includes(w))) {
      return { ok: false, status: 500, text: async () => "boom" };
    }
    const places = (spec[word] || []).map(([rating, reviews, miles = 0.5], i) => ({
      id: `${word}-${i}`,
      displayName: { text: `${word} ${i}` },
      rating,
      userRatingCount: reviews,
      googleMapsUri: `https://maps.google.com/?cid=${i}`,
      location: { latitude: 40.7484 + miles / 69, longitude: -73.9967 },
    }));
    return { ok: true, json: async () => ({ places }) };
  };
  return { fetchImpl, calls };
}

test("one failing category doesn't blank the page; the card is marked failed", async () => {
  const { fetchImpl } = fakeGoogle(
    { attractions: [[4.8, 900], [4.6, 500], [4.5, 300]], restaurants: [[4.7, 2000]] },
    { failOn: ["restaurants"] }
  );
  const r = await searchZip("10001", { apiKey: "k", fetchImpl });
  assert.equal(r.partial, true);
  const restaurants = r.cards.find((c) => c.id === "restaurants");
  assert.equal(restaurants.failed, true);
  assert.equal(r.cards.find((c) => c.id === "sights").places.length, 3);
});

test("partial results are not cached, so the next search retries", async () => {
  const { fetchImpl, calls } = fakeGoogle({ attractions: [[4.8, 900]] }, { failOn: ["restaurants"] });
  await searchZip("10001", { apiKey: "k", fetchImpl });
  await searchZip("10001", { apiKey: "k", fetchImpl });
  assert.equal(calls.length, 4);
});

test("when every lookup fails the error is raised, not an empty page", async () => {
  const { fetchImpl } = fakeGoogle({}, { failOn: ["attractions", "restaurants"] });
  await assert.rejects(searchZip("10001", { apiKey: "k", fetchImpl }));
});

test("two identical searches at once share one set of Google calls", async () => {
  const { fetchImpl, calls } = fakeGoogle({ attractions: [[4.8, 900]], restaurants: [[4.7, 2000]] });
  await Promise.all([
    searchZip("10001", { apiKey: "k", fetchImpl }),
    searchZip("10001", { apiKey: "k", fetchImpl }),
  ]);
  assert.equal(calls.length, 2);
});

test("local places are kept and only topped up from nearby", async () => {
  // Two local places and a famous one 10 miles away: both locals stay, the far one fills slot 3.
  const { fetchImpl } = fakeGoogle({
    attractions: [[4.5, 400, 1], [4.4, 300, 2], [4.9, 50000, 10], [4.8, 900, 40]],
    restaurants: [],
  });
  const r = await searchZip("10001", { apiKey: "k", fetchImpl });
  const sights = r.cards.find((c) => c.id === "sights");
  assert.deepEqual(sights.places.map((p) => p.id), ["attractions-0", "attractions-1", "attractions-2"]);
  assert.equal(sights.nearby, true);
  assert.ok(sights.places.every((p) => p.miles <= 15), "nothing beyond 15 miles");
});

test("a zip with no places returns empty cards, not an error", async () => {
  const { fetchImpl } = fakeGoogle({ attractions: [], restaurants: [] });
  const r = await searchZip("59001", { apiKey: "k", fetchImpl });
  assert.ok(r.cards.every((c) => c.places.length === 0 && !c.failed));
});

test("the search query and location sent to Google match the zip", async () => {
  const { fetchImpl, calls } = fakeGoogle({});
  await searchZip("02108", { apiKey: "k", fetchImpl });
  for (const body of calls) {
    assert.match(body.textQuery, / near 02108$/);
    assert.equal(body.locationBias.circle.center.latitude, 42.3576);
    assert.ok(body.locationBias.circle.radius <= 50000, "Google's maximum radius");
  }
  assert.equal(calls.find((b) => b.textQuery.includes("restaurants")).includedType, "restaurant");
});

test("zip lookup trims spaces and rejects military mail codes", () => {
  assert.equal(lookupZip(" 10001 ").city, "New York");
  assert.equal(lookupZip("09001"), null);
  assert.equal(lookupZip("00601").state, "PR");
  assert.equal(lookupZip(null), null);
});

test("map links are https only", () => {
  assert.equal(safeUrl("javascript:alert(1)", "https://x"), "https://x");
  assert.equal(safeUrl("http://maps.google.com", "https://x"), "https://x");
  assert.equal(safeUrl("https://maps.google.com/?cid=1", "https://x"), "https://maps.google.com/?cid=1");
  const p = normalize({ id: "abc", googleMapsUri: "javascript:alert(1)" });
  assert.match(p.mapsUrl, /^https:\/\/www\.google\.com\/maps\/place\/\?q=place_id:abc$/);
});

test("places without a rating or that closed are never shown", async () => {
  const { fetchImpl } = fakeGoogle({ attractions: [[null, 0], [4.9, 1000]], restaurants: [] });
  const r = await searchZip("10001", { apiKey: "k", fetchImpl });
  assert.deepEqual(r.cards[0].places.map((p) => p.id), ["attractions-1"]);
});
