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
const cache = new Map(); // key -> { at, value }

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

// Pick 3 from the local area first, then widen to nearby if short.
function pickThree(places, exclude) {
  const local = topN(within(places, LOCAL_MILES), 3, exclude);
  if (local.length >= 3) return { places: local, nearby: false };
  const wider = topN(within(places, NEARBY_MILES), 3, exclude);
  return { places: wider, nearby: wider.length > local.length };
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

// Main entry: returns { zip, city, state, group, demo, cards: [{ id, title, nearby, places }] }.
export async function searchZip(zip, { group = "core", apiKey, fetchImpl } = {}) {
  const loc = lookupZip(zip);
  if (!loc) throw new SearchError("unknown_zip", "We couldn't find that zip code.");

  const demo = !apiKey;
  const key = `${zip}:${group}:${demo ? "demo" : "live"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.value, cached: true };

  const cats = categoriesFor(group);
  const fetched = await Promise.all(
    cats.map(async (c) => {
      if (c.derived) return [c, []];
      const raw = demo
        ? demoPlaces(c.id, loc)
        : await searchText({
            apiKey,
            query: `${c.query} near ${zip}`,
            lat: loc.lat,
            lng: loc.lng,
            radiusMeters: BIAS_RADIUS_METERS,
            includedType: c.includedType,
            fetchImpl,
          });
      return [c, withDistance(raw, loc)];
    })
  );

  // Fill cards in order so a place shown in one card is not repeated in a later one.
  const shown = new Set();
  const pool = fetched.flatMap(([, places]) => places);
  const cards = [];
  for (const [c, places] of fetched) {
    let pick;
    if (c.derived) {
      const gems = topGems(within(pool, NEARBY_MILES), 3, shown);
      pick = { places: gems, nearby: gems.some((p) => p.miles != null && p.miles > LOCAL_MILES) };
    } else {
      pick = pickThree(places, shown);
    }
    pick.places.forEach((p) => shown.add(p.id));
    cards.push({ id: c.id, title: c.title, nearby: pick.nearby, places: pick.places.map(publicPlace) });
  }

  const value = { zip: loc.zip, city: loc.city, state: loc.state, group, demo, cards };
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearCache() {
  cache.clear();
}
