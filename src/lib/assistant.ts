import {
  listings as defaultListings,
  vendors as defaultVendors,
  money,
} from "./catalog";
import { demoRunners, matchRunners, Runner } from "./runners";
export function discover(
  message: string,
  previousListing?: string,
  catalog = { listings: defaultListings, vendors: defaultVendors },
  runners: Runner[] = demoRunners(),
) {
  const { listings, vendors } = catalog;
  const searchListings = (
    query: string,
    category = "All",
    maxPrice = Infinity,
  ) => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter(
      (l) =>
        l.active &&
        l.inventory > 0 &&
        l.price <= maxPrice &&
        (category === "All" || l.category === category) &&
        (!words.length ||
          words.some((w) =>
            `${l.title} ${l.description} ${l.category}`
              .toLowerCase()
              .includes(w),
          )),
    );
  };
  const q = message.toLowerCase();
  let results = searchListings(q);
  let text = "Here are a few things close to home.";
  if (/hungry|dinner|food/.test(q)) {
    results = searchListings("", "Food", 2500);
    text =
      "A little sweet, a little savory. These demo kitchens have something available.";
  }
  if (/gift|birthday|wife/.test(q)) {
    results = searchListings("", "Gifts", 4000);
    text =
      "For a gift under $40, these local demo makers have some lovely options.";
  }
  if (/happening|around me/.test(q)) {
    results = listings.filter((l) => l.active && l.inventory > 0);
    text = `There are ${vendors.length} demo vendors and ${runners.length} demo runners nearby. All businesses shown here are fictional demo data.`;
  }
  if (/roll|habanero/.test(q)) {
    results = searchListings("habanero cinnamon");
    const l = results[0];
    text = l
      ? `${l.description} ${money(l.price)} each, with ${l.inventory} available in the catalog.`
      : "No cinnamon rolls currently available.";
  }
  if (/get me|pick.?up|two|runner/.test(q)) {
    const l = listings.find((l) => l.id === previousListing) || results[0];
    results = l ? [l] : [];
    if (!l)
      return {
        text: "No available listing matches that request.",
        listings: [],
        vendorIds: [],
        source: "catalog",
        tools: ["searchListings"],
      };
    const vendor = vendors.find((v) => v.id === l.vendorId);
    if (!vendor || !l.active || l.inventory < 1)
      return {
        text: "That item is no longer available.",
        listings: [],
        vendorIds: [],
        source: "catalog",
        tools: ["getListingAvailability"],
      };
    const matches = matchRunners(
      runners,
      vendor.coordinates,
      l.category,
      l.vendorId,
    );
    text = matches[0]
      ? `${matches[0].name} ${matches[0].existingTrip ? "is already heading toward this demo vendor" : "may be compatible with this pickup"}. This is an approximate straight-line match, not a road-route estimate. Review the item to prepare an order.`
      : "No compatible demo runners right now.";
  }
  return {
    text,
    listings: results.slice(0, 4),
    vendorIds: results.slice(0, 4).map((l) => l.vendorId),
    source: "catalog",
    tools: ["searchListings", "findCompatibleRunners"],
  };
}
