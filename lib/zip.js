import zipcodes from "zipcodes";

export const ZIP_PATTERN = /^\d{5}$/;

// Returns { zip, city, state, lat, lng } or null when the zip code is not a known US zip.
export function lookupZip(zip) {
  if (!ZIP_PATTERN.test(zip || "")) return null;
  const z = zipcodes.lookup(zip);
  if (!z || z.country !== "US" || z.latitude == null) return null;
  return { zip: z.zip, city: z.city, state: z.state, lat: z.latitude, lng: z.longitude };
}
