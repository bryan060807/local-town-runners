export type Listing = {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  category: string;
  mode: "SELL" | "MAKE" | "DO";
  price: number;
  inventory: number;
  local: boolean;
  active: boolean;
  emoji: string;
  photos?: string[];
};
export type Vendor = {
  id: string;
  name: string;
  category: string;
  coordinates: [number, number];
  demo: boolean;
  verified?: boolean;
  description?: string;
  hours?: Record<string, string>;
  websiteUrl?: string;
  socialUrls?: string[];
  logoUrl?: string;
  coverUrl?: string;
};
const entries = [
  [
    "Riverbend Bakery",
    "Food",
    "Habanero Cinnamon Rolls",
    "Sweet cinnamon, a little heat. Baked this morning.",
    450,
    "SELL",
    "🥐",
  ],
  [
    "Main Street Kitchen",
    "Food",
    "Garden bowl",
    "Roasted vegetables, rice and a bright herb dressing.",
    1400,
    "SELL",
    "🥗",
  ],
  [
    "Backyard Smokehouse",
    "Food",
    "Smoked brisket sandwich",
    "Slow smoked brisket with house slaw.",
    1250,
    "SELL",
    "🍔",
  ],
  [
    "Clay & River Studio",
    "Gifts",
    "Hand-thrown ceramic mug",
    "A one-of-a-kind, locally made morning companion.",
    2800,
    "SELL",
    "🏺",
  ],
  [
    "Oak Lane Woodworks",
    "Makers",
    "Custom walnut cutting board",
    "Made to order; allow seven days.",
    3800,
    "MAKE",
    "🪵",
  ],
  [
    "Hillside Farm Stand",
    "Farm",
    "Seasonal produce basket",
    "A colorful selection from a demo local farm.",
    1800,
    "SELL",
    "🥕",
  ],
  [
    "Thread & Thistle",
    "Gifts",
    "Handmade linen tote",
    "Durable linen with a hand-stitched pocket.",
    3200,
    "SELL",
    "👜",
  ],
  [
    "River Light Art",
    "Makers",
    "Mississippi river print",
    "An archival print inspired by river country.",
    2400,
    "SELL",
    "🎨",
  ],
  [
    "Town Workshop",
    "Services",
    "Trailer gate welding consultation",
    "Discuss your repair; final quote after inspection.",
    2500,
    "DO",
    "🔧",
  ],
  [
    "Neighborly Repairs",
    "Services",
    "Handyman consultation",
    "Small home repairs, discussed before scheduling.",
    2000,
    "DO",
    "🛠️",
  ],
  [
    "Corner Hardware Demo",
    "Shops",
    "Garden hand tool set",
    "Three everyday tools for your garden.",
    2200,
    "SELL",
    "🪴",
  ],
  [
    "Pantry Basket",
    "Shops",
    "Grocery essentials bundle",
    "Bread, eggs and pantry basics.",
    1900,
    "SELL",
    "🛒",
  ],
  [
    "Little Stitch Clothing",
    "Shops",
    "Cotton river-town tee",
    "Soft cotton, locally printed.",
    2600,
    "SELL",
    "👕",
  ],
  [
    "Bloom & Gather",
    "Gifts",
    "Seasonal flower bouquet",
    "A cheerful, locally arranged gift.",
    3500,
    "MAKE",
    "💐",
  ],
  [
    "Morning Coffee Cart",
    "Food",
    "Coffee & breakfast biscuit",
    "Fresh coffee with a warm biscuit.",
    750,
    "SELL",
    "☕",
  ],
] as const;
export const vendors: Vendor[] = entries.map((e, i) => ({
  id: `vendor-${i + 1}`,
  name: e[0],
  category: e[1],
  coordinates: [
    -91.0515 + ((i % 4) - 1.5) * 0.005,
    39.4489 + (Math.floor(i / 4) - 1.5) * 0.003,
  ],
  demo: true,
}));
export const listings: Listing[] = entries.map((e, i) => ({
  id: `listing-${i + 1}`,
  vendorId: `vendor-${i + 1}`,
  title: e[2],
  description: e[3],
  category: e[1],
  price: e[4],
  mode: e[5],
  emoji: e[6],
  inventory: e[5] === "SELL" ? 12 : 4,
  local: true,
  active: true,
}));
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
export function searchListings(
  query: string,
  category = "All",
  maxPrice = Infinity,
) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return listings.filter(
    (l) =>
      l.active &&
      l.inventory > 0 &&
      l.price <= maxPrice &&
      (category === "All" || l.category === category) &&
      (!words.length ||
        words.some((w) =>
          `${l.title} ${l.description} ${l.category}`.toLowerCase().includes(w),
        )),
  );
}
