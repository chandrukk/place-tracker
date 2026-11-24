// The "Top 3" categories. `group: "core"` cards show on load; "more" cards load on tap.
// `query` is sent to Google Places Text Search together with the zip code's location.
// `includedType` (optional) narrows results to one Google place type.

export const CATEGORIES = [
  { id: "sights", title: "Top sights", group: "core", query: "top tourist attractions and landmarks" },
  { id: "restaurants", title: "Top restaurants", group: "core", query: "best restaurants", includedType: "restaurant" },
  // Hidden gems are picked from places already fetched for the other core cards (see lib/search.js).
  { id: "gems", title: "Hidden gems", group: "core", derived: true },
  { id: "coffee", title: "Coffee & dessert", group: "more", query: "best coffee shops bakeries and dessert" },
  { id: "outdoors", title: "Parks & outdoors", group: "more", query: "best parks trails and outdoor spots" },
  { id: "kids", title: "Kids & family", group: "more", query: "family friendly things to do with kids" },
  { id: "photo", title: "Photo spots", group: "more", query: "scenic viewpoints and photo spots" },
  { id: "nightlife", title: "Nightlife & bars", group: "more", query: "best bars and nightlife" },
];

export const GROUPS = ["core", "more"];

export function categoriesFor(group) {
  return CATEGORIES.filter((c) => c.group === group);
}
