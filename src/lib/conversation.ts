import { Listing } from "./catalog";
export type ConversationContext = {
  selectedListingId?: string;
  resultIds?: string[];
};
/** Context is a hint, never authority: every identifier is resolved in current catalog. */
export function conversationTool(
  message: string,
  context: ConversationContext,
  listings: Listing[],
) {
  const q = message.toLowerCase();
  const available = listings.filter((l) => l.active && l.inventory > 0);
  const prior = available.filter((l) => context.resultIds?.includes(l.id));
  const named = available.find(
    (l) =>
      q.includes(l.title.toLowerCase()) ||
      (/habanero|cinnamon roll/.test(q) &&
        /habanero cinnamon/.test(l.title.toLowerCase())),
  );
  const selected =
    named || available.find((l) => l.id === context.selectedListingId);
  const search = (
    category = "All",
    maxPriceCents = 10000000,
    madeLocal = false,
  ) => ({
    name: "searchListings",
    args: { query: "", category, maxPriceCents, madeLocal },
  });
  if (
    /made (?:here|local|around)|made locally|locally made|actually made|independent/.test(
      q,
    )
  ) {
    if (prior.length)
      return {
        name: "searchListings",
        args: {
          query: "",
          category: prior.every((l) => l.category === prior[0].category)
            ? prior[0].category
            : "All",
          maxPriceCents: Math.max(...prior.map((l) => l.price)),
          madeLocal: true,
        },
      };
    return search("All", 10000000, true);
  }
  if (/secondhand|second.hand|used items/.test(q))
    return {
      name: "searchListings",
      args: {
        query: "",
        category: "All",
        maxPriceCents: 10000000,
        secondhand: true,
      },
    };
  if (named && !/get me|buy|order|bring|deliver/.test(q))
    return { name: "getListingDetails", args: { listingId: named.id } };
  if (/get me|buy (?:one|two|\d+)|order (?:one|two|\d+)/.test(q)) {
    if (!selected) return null;
    const n = q.match(/\b(\d+)\b/);
    return {
      name: "prepareOrder",
      args: {
        listingId: selected.id,
        quantity: n ? Number(n[1]) : /\btwo\b/.test(q) ? 2 : 1,
      },
    };
  }
  if (/bring|deliver|runner|heading|tonight|fulfill/.test(q) && selected)
    return {
      name: /tonight|fulfill/.test(q)
        ? "estimateFulfillment"
        : "findCompatibleRunners",
      args: { listingId: selected.id },
    };
  if (
    /show me (?:that|the first)|tell me (?:about|more)|what about (?:that|it)/.test(
      q,
    ) &&
    selected
  )
    return { name: "getListingDetails", args: { listingId: selected.id } };
  if (/gift|birthday|wife/.test(q)) {
    const budget = q.match(/(?:\$|under\s+|around\s+)(\d+)/);
    return search("Gifts", budget ? Number(budget[1]) * 100 : 4000);
  }
  if (/deliver(?:ed|y)?.*(?:today|tonight)/.test(q) && !selected)
    return search();
  if (/hungry|food|dinner/.test(q)) return search("Food", 2500);
  if (/happening|available around|around (?:me|here)|what.s good/.test(q))
    return { name: "getNearbyActivity", args: {} };
  return null;
}
