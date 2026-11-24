import { test } from "node:test";
import assert from "node:assert/strict";
import { weightedScore, topN, topGems, isHiddenGem } from "../lib/ranking.js";

const p = (id, rating, reviews, extra = {}) => ({ id, name: id, rating, reviews, ...extra });

test("a 4.7 with 4,000 reviews beats a 5.0 with 3 reviews", () => {
  const top = topN([p("tiny", 5.0, 3), p("popular", 4.7, 4000), p("ok", 4.2, 500)], 3);
  assert.equal(top[0].id, "popular");
});

test("weighted score pulls low-review places toward the baseline", () => {
  assert.ok(weightedScore(5.0, 3) < 4.1);
  assert.ok(weightedScore(4.7, 4000) > 4.69);
});

test("among uniformly strong places, a few 5-star reviews still don't win", () => {
  const top = topN([p("few", 4.9, 12), p("solid", 4.8, 180), p("famous", 4.7, 4200)], 3);
  assert.deepEqual(top.map((x) => x.id), ["famous", "solid", "few"]);
});

test("topN returns at most n, skips closed, unrated, excluded and duplicate places", () => {
  const places = [
    p("a", 4.8, 900), p("a", 4.8, 900), p("closed", 4.9, 2000, { status: "CLOSED_PERMANENTLY" }),
    p("norating", null, 0), p("b", 4.6, 300), p("c", 4.5, 800), p("d", 4.4, 100),
  ];
  const top = topN(places, 3, new Set(["c"]));
  assert.deepEqual(top.map((x) => x.id), ["a", "b", "d"]);
});

test("hidden gems need a high rating and a modest review count", () => {
  assert.equal(isHiddenGem(p("g", 4.8, 120)), true);
  assert.equal(isHiddenGem(p("famous", 4.8, 5000)), false);
  assert.equal(isHiddenGem(p("new", 5.0, 5)), false);
  assert.equal(isHiddenGem(p("meh", 4.3, 100)), false);
  const gems = topGems([p("g1", 4.7, 50), p("g2", 4.9, 200), p("big", 4.9, 9000)], 3, new Set());
  assert.deepEqual(gems.map((x) => x.id), ["g2", "g1"]);
});
