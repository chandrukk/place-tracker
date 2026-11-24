// Sample data used when no GOOGLE_MAPS_API_KEY is set, so the page can be previewed
// and tested without spending API calls. Places are placed around the zip's centre.

const NAMES = {
  sights: ["City History Museum", "Old Town Square", "Riverside Lighthouse", "Art Center", "Clock Tower", "Botanical Garden"],
  restaurants: ["Mama Rosa's Kitchen", "The Taco Stand", "Harbor Grill", "Pho Corner", "Burger Barn", "Spice Route"],
  coffee: ["Morning Grind", "Sweet Crumb Bakery", "Scoops Ice Cream", "Bean There Cafe"],
  outdoors: ["Lakeside Park", "Ridge Trail", "Community Green", "Sunset Beach"],
  kids: ["Children's Discovery Museum", "Splash Pad Park", "Mini Zoo", "Adventure Playground"],
  photo: ["Hilltop Overlook", "Painted Mural Alley", "Bridge Viewpoint", "Harbor Steps"],
  nightlife: ["The Blue Note", "Corner Pub", "Rooftop Lounge", "Brewhouse 12"],
};

const RATINGS = [
  [4.7, 4200], [4.9, 12], [4.5, 2100], [4.8, 180], [4.4, 900], [4.7, 95],
];

export function demoPlaces(categoryId, loc) {
  const names = NAMES[categoryId] || [];
  return names.map((name, i) => {
    const [rating, reviews] = RATINGS[i % RATINGS.length];
    return {
      id: `demo-${categoryId}-${i}`,
      name,
      rating,
      reviews,
      type: "Sample place",
      address: `${loc.city}, ${loc.state}`,
      mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${loc.zip}`)}`,
      status: "OPERATIONAL",
      lat: loc.lat + 0.01 * (i + 1),
      lng: loc.lng + 0.005 * i,
    };
  });
}
