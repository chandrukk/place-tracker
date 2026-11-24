// Ranking rules from the backlog doc.
//
// Weighted rating (Bayesian average): score = v/(v+m) * R + m/(v+m) * C
//   R = place rating, v = review count, C = baseline rating, m = minimum-review weight.
// A 5.0 with 3 reviews therefore does not beat a 4.7 with 4,000.
// C is a fixed, deliberately modest baseline (not the mean of the candidates): when every
// candidate is strong, a candidate mean near 4.7 would let a handful of 5-star reviews win.

export const MIN_REVIEW_WEIGHT = 50;
export const BASELINE_RATING = 4.0;
export const GEM_MIN_RATING = 4.6;
export const GEM_MIN_REVIEWS = 20;
export const GEM_MAX_REVIEWS = 300;

export function weightedScore(rating, reviews, baseline = BASELINE_RATING, m = MIN_REVIEW_WEIGHT) {
  const v = reviews || 0;
  const R = rating || 0;
  return (v / (v + m)) * R + (m / (v + m)) * baseline;
}

function usable(p) {
  return p && p.rating != null && (p.reviews || 0) > 0 && p.status !== "CLOSED_PERMANENTLY";
}

// Return the top `n` places, skipping any id in `exclude` (a Set) and de-duplicating by id.
export function topN(places, n = 3, exclude = new Set()) {
  const candidates = [];
  const seen = new Set();
  for (const p of places) {
    if (!usable(p) || exclude.has(p.id) || seen.has(p.id)) continue;
    seen.add(p.id);
    candidates.push(p);
  }
  return candidates
    .map((p) => ({ ...p, score: weightedScore(p.rating, p.reviews) }))
    .sort((a, b) => b.score - a.score || b.reviews - a.reviews)
    .slice(0, n);
}

export function isHiddenGem(p) {
  return (
    usable(p) &&
    p.rating >= GEM_MIN_RATING &&
    p.reviews >= GEM_MIN_REVIEWS &&
    p.reviews <= GEM_MAX_REVIEWS
  );
}

// Hidden gems: highly rated but not (yet) widely reviewed. Ranked by rating, then reviews.
export function topGems(places, n = 3, exclude = new Set()) {
  const seen = new Set();
  return places
    .filter((p) => {
      if (!isHiddenGem(p) || exclude.has(p.id) || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
    .slice(0, n);
}
