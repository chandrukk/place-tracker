// Vercel serverless function: GET /api/search?zip=10001&group=core|more
import { searchZip, SearchError } from "../lib/search.js";
import { GROUPS } from "../lib/categories.js";
import { ZIP_PATTERN } from "../lib/zip.js";
import { PlacesError } from "../lib/places.js";

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const zip = (url.searchParams.get("zip") || "").trim();
  const group = url.searchParams.get("group") || "core";

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!ZIP_PATTERN.test(zip)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "invalid_zip", message: "Please enter a 5-digit US zip code." }));
  }
  if (!GROUPS.includes(group)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: "invalid_group", message: "Unknown result group." }));
  }

  try {
    const result = await searchZip(zip, { group, apiKey: process.env.GOOGLE_MAPS_API_KEY });
    // Let the CDN reuse results for a zip for a day, so repeat searches cost nothing.
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=3600");
    res.statusCode = 200;
    return res.end(JSON.stringify(result));
  } catch (err) {
    if (err instanceof SearchError) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: err.code, message: err.message }));
    }
    console.error(err);
    const quota = err instanceof PlacesError && err.status === 429;
    res.statusCode = quota ? 503 : 502;
    return res.end(
      JSON.stringify({
        error: quota ? "busy" : "upstream",
        message: quota
          ? "We're getting a lot of searches right now. Please try again in a minute."
          : "Something went wrong looking up places. Please try again.",
      })
    );
  }
}
