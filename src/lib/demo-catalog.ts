import { Listing } from "./catalog";
export const demoRoles = ["customer", "vendor", "runner"] as const;
export type DemoRole = (typeof demoRoles)[number];
export const demoNames = {
  customer: "Alex Carter",
  vendor: "Riverbend Market & Goods",
  runner: "Jordan Ellis",
};
export const demoAddress =
  "DEMO TEST ADDRESS — not a real residence, Louisiana, MO";
export const templateWorkspace = "30000000-0000-4000-8000-000000000001";
export const demoShops = [
  {
    name: "Riverbend Market & Goods",
    category: "Gifts",
    description:
      "Fictional demo general store with gifts, practical household finds and independently made crafts.",
    coordinates: [-91.05, 39.45] as [number, number],
  },
  {
    name: "Demo Hearth Bakery",
    category: "Food",
    description:
      "Fictional baked goods for a Sandbox marketplace demonstration.",
    coordinates: [-91.06, 39.45] as [number, number],
  },
  {
    name: "Demo Second Chance Finds",
    category: "Shops",
    description:
      "Fictional secondhand items. Condition descriptions are test data.",
    coordinates: [-91.05, 39.44] as [number, number],
  },
  {
    name: "Demo Neighbor Workshop",
    category: "Services",
    description:
      "Fictional services and custom craft inquiries. Quotes require vendor agreement.",
    coordinates: [-91.04, 39.45] as [number, number],
  },
];
const products: [
  number,
  string,
  string,
  number,
  Listing["mode"],
  string,
  boolean,
  boolean,
][] = [
  [0, "Handmade River Mug", "Gifts", 2800, "SELL", "🏺", true, false],
  [0, "Woven Market Tote", "Gifts", 3200, "SELL", "👜", true, false],
  [0, "Cedar Keepsake Box", "Makers", 3600, "SELL", "📦", true, false],
  [0, "Kitchen Herb Planter", "Gifts", 1800, "SELL", "🌿", true, false],
  [0, "Soy Candle Pair", "Gifts", 2400, "SELL", "🕯️", true, false],
  [0, "Cotton Kitchen Towels", "Shops", 1600, "SELL", "🧺", false, false],
  [0, "Reusable Lunch Tin", "Shops", 1400, "SELL", "🥡", false, false],
  [0, "Seasonal Door Wreath", "Makers", 3800, "SELL", "🌼", true, false],
  [0, "Handmade Greeting Cards", "Gifts", 800, "SELL", "💌", true, false],
  [0, "Wooden Serving Board", "Makers", 3500, "SELL", "🪵", true, false],
  [1, "Habanero Cinnamon Rolls", "Food", 450, "SELL", "🥐", true, false],
  [1, "Honey Oat Loaf", "Food", 850, "SELL", "🍞", true, false],
  [1, "Lemon Cookie Box", "Food", 1200, "SELL", "🍋", true, false],
  [1, "Berry Scone Pair", "Food", 700, "SELL", "🫐", true, false],
  [1, "Garden Lunch Bowl", "Food", 1400, "SELL", "🥗", true, false],
  [2, "Secondhand Reading Lamp", "Shops", 2200, "SELL", "💡", false, true],
  [2, "Secondhand Board Game", "Gifts", 1200, "SELL", "🎲", false, true],
  [2, "Secondhand Picnic Basket", "Shops", 1800, "SELL", "🧺", false, true],
  [2, "Secondhand Book Bundle", "Gifts", 1000, "SELL", "📚", false, true],
  [2, "Secondhand Garden Tools", "Farm", 2000, "SELL", "🛠️", false, true],
  [3, "Custom House Sign", "Makers", 0, "MAKE", "🪧", true, false],
  [3, "Bicycle Tune-up Inquiry", "Services", 0, "DO", "🚲", true, false],
  [3, "Garden Help Inquiry", "Services", 0, "DO", "🌱", true, false],
  [3, "Custom Gift Wrapping", "Services", 0, "DO", "🎁", true, false],
  [3, "Seasonal Table Arrangement", "Makers", 0, "MAKE", "🌷", true, false],
];
export const demoProducts = products.map(
  ([shop, title, category, price, mode, emoji, local, secondhand]) => ({
    shop,
    title,
    category,
    price,
    mode,
    emoji,
    local,
    secondhand,
    inventory: mode === "SELL" ? 12 : 4,
    description: `Fictional demo listing. ${mode === "SELL" ? "Test stock and price are persisted; no real goods are promised." : "Inquiry only: ask the vendor for scope, availability and a quote before any agreement."} ${secondhand ? "Secondhand condition is demonstration data." : ""}`,
  }),
);
