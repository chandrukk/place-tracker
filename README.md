# Place Tracker

Type a US zip code, get the top 3 places to see, eat and explore there. No login, no filters.

- **On load:** Top sights · Top restaurants · Hidden gems
- **Under "More":** Coffee & dessert · Parks & outdoors · Kids & family · Photo spots · Nightlife & bars

Requirements and backlog live in the product backlog doc (linked from the project thread).

## How it works

| Piece | File |
| --- | --- |
| Search page (one HTML file, no framework) | `public/index.html` |
| API: `GET /api/search?zip=10001&group=core\|more` | `api/search.js` |
| Zip code → location (offline database, no API calls) | `lib/zip.js` |
| Google Places API (New) Text Search | `lib/places.js` |
| Categories and their search phrases | `lib/categories.js` |
| Ranking: weighted rating, hidden gems | `lib/ranking.js` |
| Fill cards, no repeats, nearby fallback, 24h cache | `lib/search.js` |

**Ranking.** `score = v/(v+m)·R + m/(v+m)·C`, with R the rating, v the review count, m = 50 and baseline C = 4.0.
A 4.7 with 4,000 reviews beats a 4.9 with 12. **Hidden gems** are rated 4.6+ with 20 to 300 reviews.
Places within 5 miles of the zip's centre come first; if a card has fewer than 3, it widens to 15 miles and shows "includes nearby".

**Cost control.** One new zip costs 2 Google searches on load and 5 more only if "More" is tapped. Results are cached for 24 hours in the function and at Vercel's CDN.

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000, sample data
GOOGLE_MAPS_API_KEY=your-key npm run dev   # real data
npm test            # unit, regression and API tests (no browser, ~1s)
npm run test:e2e    # browser tests on a phone and a desktop screen (sample data)
```

GitHub runs both suites on every pull request and every push to `main` (`.github/workflows/tests.yml`).

Without `GOOGLE_MAPS_API_KEY` the app runs on sample data and says so on screen.

## Deploy (Vercel, free)

1. Sign in at [vercel.com](https://vercel.com) with GitHub and import `place-tracker`. Keep the defaults ("Other" framework).
2. In the project's **Settings → Environment Variables**, add `GOOGLE_MAPS_API_KEY` with your key.
3. Deploy. Every push to `main` redeploys.

**Never commit the API key.** This repo is public. Restrict the key to "Places API (New)" in Google Cloud and set a budget alert.
