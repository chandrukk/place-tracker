// Google Places API (New) Text Search.
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

// Only the fields we show. rating/userRatingCount are billed at the Enterprise tier.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
  "places.businessStatus",
  "places.shortFormattedAddress",
  "places.location",
].join(",");

export class PlacesError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function normalize(p) {
  return {
    id: p.id,
    name: p.displayName?.text ?? "Unknown place",
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? 0,
    type: p.primaryTypeDisplayName?.text ?? "",
    address: p.shortFormattedAddress ?? "",
    mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/place/?q=place_id:${p.id}`,
    status: p.businessStatus ?? "OPERATIONAL",
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
  };
}

// Search around a point. `radiusMeters` biases results to the area (max 50,000).
export async function searchText({ apiKey, query, lat, lng, radiusMeters, includedType, fetchImpl = fetch }) {
  const body = {
    textQuery: query,
    pageSize: 20,
    locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusMeters } },
  };
  if (includedType) body.includedType = includedType;

  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new PlacesError(`Places API ${res.status}: ${text.slice(0, 200)}`, res.status);
  }
  const data = await res.json();
  return (data.places || []).map(normalize);
}
