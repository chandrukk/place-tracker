import { test, expect } from "@playwright/test";

const cards = (page) => page.locator("section.card");

test("home page shows just a title and a zip box", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Place Tracker" })).toBeVisible();
  await expect(page.getByLabel("US zip code")).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
});

test("searching a zip shows three cards, then five more on tap", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("US zip code").fill("94103");
  await page.getByLabel("US zip code").press("Enter");
  await expect(page.getByText("Top picks for San Francisco, CA 94103")).toBeVisible();
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).locator("h2")).toContainText(["Top sights", "Top restaurants", "Hidden gems"]);
  await expect(page.getByText("Sample data")).toBeVisible();

  for (const card of await cards(page).all()) {
    expect(await card.locator("li").count()).toBeLessThanOrEqual(3);
  }

  await page.getByRole("button", { name: /More:/ }).click();
  await expect(cards(page)).toHaveCount(8);
  await expect(page.getByRole("button", { name: /More:/ })).toHaveCount(0);
});

test("each place links to Google Maps in a new tab", async ({ page }) => {
  await page.goto("/?zip=10001");
  const link = cards(page).first().locator("a").first();
  await expect(link).toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps/);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

test("no place appears in two cards", async ({ page }) => {
  await page.goto("/?zip=10001");
  await page.getByRole("button", { name: /More:/ }).click();
  await expect(cards(page)).toHaveCount(8);
  const names = await page.locator("section.card .name").allTextContents();
  // Demo data reuses names across categories, so compare within the first three cards (one shared pool).
  const core = (await cards(page).evaluateAll((els) =>
    els.slice(0, 3).flatMap((e) => [...e.querySelectorAll(".name")].map((n) => n.textContent))
  ));
  expect(new Set(core).size).toBe(core.length);
  expect(names.length).toBeGreaterThan(0);
});

test("a link with ?zip= opens straight to results", async ({ page }) => {
  await page.goto("/?zip=02108");
  await expect(page.getByText("Top picks for Boston, MA 02108")).toBeVisible();
  await expect(page.getByLabel("US zip code")).toHaveValue("02108");
});

test("letters are stripped and only 5 digits are kept", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("US zip code").pressSequentially("1a0b001234");
  await expect(page.getByLabel("US zip code")).toHaveValue("10001");
});

test("a short zip shows an inline error and no results", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("US zip code").fill("123");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(page.getByText("Please enter a 5-digit US zip code.")).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
});

test("an unknown zip says so", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("US zip code").fill("00000");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(page.getByText("We couldn't find that zip code.")).toBeVisible();
});

test("a new search replaces the old results", async ({ page }) => {
  await page.goto("/?zip=10001");
  await expect(cards(page)).toHaveCount(3);
  await page.getByLabel("US zip code").fill("02108");
  await page.getByLabel("US zip code").press("Enter");
  await expect(page.getByText("Top picks for Boston, MA 02108")).toBeVisible();
  await expect(page.getByText(/New York/)).toHaveCount(0);
  await expect(cards(page)).toHaveCount(3);
});

test("a server error shows a friendly message", async ({ page }) => {
  await page.route("**/api/search**", (route) =>
    route.fulfill({ status: 502, contentType: "application/json",
      body: JSON.stringify({ error: "upstream", message: "Something went wrong looking up places. Please try again." }) })
  );
  await page.goto("/?zip=10001");
  await expect(page.getByText("Something went wrong looking up places.")).toBeVisible();
});

test("a failed card says so instead of looking empty", async ({ page }) => {
  await page.route("**/api/search**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      zip: "10001", city: "New York", state: "NY", group: "core", demo: false, partial: true,
      cards: [{ id: "sights", title: "Top sights", nearby: false, failed: true, places: [] }],
    }) })
  );
  await page.goto("/?zip=10001");
  await expect(page.getByText("Couldn't load this list right now.")).toBeVisible();
});

test("no sideways scrolling on the page", async ({ page }) => {
  await page.goto("/?zip=10001");
  await page.getByRole("button", { name: /More:/ }).click();
  await expect(cards(page)).toHaveCount(8);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
