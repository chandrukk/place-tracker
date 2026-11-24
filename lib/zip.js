import zipcodes from "zipcodes";

export const ZIP_PATTERN = /^\d{5}$/;

// Military mail "states" (APO/FPO/DPO) aren't real places a visitor can search.
const MILITARY_STATES = new Set(["AA", "AE", "AP"]);

// Returns { zip, city, state, lat, lng } or null when the zip code is not a known, visitable US zip.
export function lookupZip(input) {
  const zip = String(input ?? "").trim();
  if (!ZIP_PATTERN.test(zip)) return null;
  const z = zipcodes.lookup(zip);
  if (!z || z.country !== "US" || z.latitude == null || MILITARY_STATES.has(z.state)) return null;
  return { zip: z.zip, city: z.city, state: z.state, lat: z.latitude, lng: z.longitude };
}
