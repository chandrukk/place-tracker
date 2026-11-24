import { categoriesFor } from "./categories.js";
import { searchText } from "./places.js";
import { topN, topGems } from "./ranking.js";
import { lookupZip } from "./zip.js";
import { demoPlaces } from "./demo.js";

// Places within LOCAL_MILES count as "in this zip"; if a card has fewer than 3,
// we fall back to places up to NEARBY_MILES away and label the card "nearby".
export const LOCAL_MILES = 5;
export const NEARBY_MILES = 15;
const BIAS_RADIUS_METERS = 15000;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map(); // key -> { at, value }; Map keeps insertion order, oldest first
const inFlight = new Map(); // key -> Promise, so two identical searches share one lookup

function cacheSet(key, value) {
  cache.delete(key);
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

export function milesBetween(a, b) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function withDistance(places, origin) {
  return places.map((p) => ({
    ...p,
    miles: p.lat != null ? Math.round(milesBetween(origin, p) * 10) / 10 : null,
  }));
}

function within(places, miles) {
  return places.filter((p) => p.miles == null || p.miles <= miles);
}

// Pick up to 3 from the local area first, then top up from nearby places if short.
function pickThree(places, exclude) {
  const local = topN(within(places, LOCAL_MILES), 3, exclude);
  if (local.length >= 3) return { places: local, nearby: false };
  const taken = new Set([...exclude, ...local.map((p) => p.id)]);
  const extra = topN(within(places, NEARBY_MILES), 3 - local.length, taken);
  return { places: [...local, ...extra], nearby: extra.length > 0 };
}

function publicPlace(p) {
  const { id, name, rating, reviews, type, address, mapsUrl, miles } = p;
  return { id, name, rating, reviews, type, address, mapsUrl, miles };
}

export class SearchError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// Main entry: returns { zip, city, state, group, demo, partial, cards: [{ id, title, nearby, failed, places }] }.
export async function searchZip(zip, { group = "core", apiKey, fetchImpl } = {}) {
  const loc = lookupZip(zip);
  if (!loc) throw new SearchError("unknown_zip", "We couldn't find that zip code.");

  const demo = !apiKey;
  const key = `${loc.zip}:${group}:${demo ? "demo" : "live"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.value, cached: true };
  if (inFlight.has(key)) return inFlight.get(key);

  const job = buildResult(loc, group, { demo, apiKey, fetchImpl })
    .then((value) => {
      // Only cache complete answers; a partial one should be retried next time.
      if (!value.partial) cacheSet(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

async function buildResult(loc, group, { demo, apiKey, fetchImpl }) {
  const cats = categoriesFor(group);
  const settled = await Promise.allSettled(
    cats.map(async (c) => {
      if (c.derived) return [];
      const raw = demo
        ? demoPlaces(c.id, loc)
        : await searchText({
            apiKey,
            query: `${c.query} near ${loc.zip}`,
            lat: loc.lat,
            lng: loc.lng,
            radiusMeters: BIAS_RADIUS_METERS,
            includedType: c.includedType,
            fetchImpl,
          });
      return withDistance(raw, loc);
    })
  );

  // One failed category shouldn't blank the page; but if every lookup failed, report the error.
  const lookups = settled.filter((_, i) => !cats[i].derived);
  const failures = lookups.filter((r) => r.status === "rejected");
  if (lookups.length && failures.length === lookups.length) throw failures[0].reason;
  for (const f of failures) console.error(f.reason);

  // Fill cards in order so a place shown in one card is not repeated in a later one.
  const shown = new Set();
  const pool = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const cards = cats.map((c, i) => {
    const r = settled[i];
    let pick;
    if (r.status === "rejected") {
      pick = { places: [], nearby: false };
    } else if (c.derived) {
      const gems = topGems(within(pool, NEARBY_MILES), 3, shown);
      pick = { places: gems, nearby: gems.some((p) => p.miles != null && p.miles > LOCAL_MILES) };
    } else {
      pick = pickThree(r.value, shown);
    }
    pick.places.forEach((p) => shown.add(p.id));
    return {
      id: c.id,
      title: c.title,
      nearby: pick.nearby,
      failed: r.status === "rejected",
      places: pick.places.map(publicPlace),
    };
  });

  return { zip: loc.zip, city: loc.city, state: loc.state, group, demo, partial: failures.length > 0, cards };
}

export function clearCache() {
  cache.clear();
  inFlight.clear();
}
