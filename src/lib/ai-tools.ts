import { HttpError } from "./server/errors";
import { z } from "zod";
import { Listing, Vendor, money } from "./catalog";
import { Runner, matchRunners } from "./runners";
const id = z.string().min(1).max(80);
const search = z
  .object({
    query: z.string().max(100),
    category: z.enum([
      "All",
      "Food",
      "Gifts",
      "Makers",
      "Farm",
      "Shops",
      "Services",
    ]),
    maxPriceCents: z.number().int().min(0).max(10000000),
    madeLocal: z.boolean().optional(),
  })
  .strict();
export const toolSchemas = {
  searchListings: search,
  searchVendors: z.object({ query: z.string().max(100) }).strict(),
  searchServices: search,
  getNearbyActivity: z.object({}).strict(),
  getListingAvailability: z.object({ listingId: id }).strict(),
  getListingDetails: z.object({ listingId: id }).strict(),
  getVendor: z.object({ vendorId: id }).strict(),
  findCompatibleRunners: z.object({ listingId: id }).strict(),
  estimateFulfillment: z.object({ listingId: id }).strict(),
  compareOptions: z.object({ listingIds: z.array(id).min(2).max(4) }).strict(),
  prepareOrder: z
    .object({ listingId: id, quantity: z.number().int().min(1).max(20) })
    .strict(),
  getOrderStatus: z.object({ orderId: z.uuid() }).strict(),
};
export type ToolName = keyof typeof toolSchemas;
export const toolDefinitions = Object.entries(toolSchemas).map(
  ([name, schema]) => ({
    type: "function",
    function: {
      name,
      description:
        name === "prepareOrder"
          ? "Prepare a reviewable quote only; never charge or create an order"
          : name === "getOrderStatus"
            ? "Read an authorized customer order status"
            : `Read marketplace data with ${name}`,
      parameters: z.toJSONSchema(schema),
    },
  }),
);
export type ToolContext = {
  listings: Listing[];
  vendors: Vendor[];
  runners: Runner[];
  authenticated: boolean;
  orders?: Record<string, string>;
};
export type ToolResult = {
  text: string;
  listings: Listing[];
  vendorIds: string[];
  prepared?: { listingId: string; quantity: number; totalCents: number };
  matchedRunnerId?: string;
  source: string;
  tools: string[];
};
export function executeTool(
  name: string,
  argumentsValue: unknown,
  context: ToolContext,
): ToolResult {
  if (!Object.hasOwn(toolSchemas, name)) throw Error("Unknown AI tool");
  const schema = toolSchemas[name as ToolName];
  const args = schema.parse(argumentsValue) as Record<string, unknown>;
  const catalog = context.listings.filter(
    (l) =>
      l.active &&
      l.inventory > 0 &&
      context.vendors.some((v) => v.id === l.vendorId),
  );
  let result: Listing[] = [];
  let text = "";
  let prepared: ToolResult["prepared"];
  let matchedRunnerId: string | undefined;
  const listing = (value: unknown) => {
    const l = catalog.find((l) => l.id === value);
    if (!l) throw new HttpError("Listing unavailable", 409);
    return l;
  };
  if (name === "searchListings" || name === "searchServices") {
    const words = (args.query as string)
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    result = catalog
      .filter(
        (l) =>
          (name !== "searchServices" || l.mode === "DO") &&
          (args.category === "All" || l.category === args.category) &&
          l.price <= (args.maxPriceCents as number) &&
          (!args.madeLocal || l.local) &&
          (!words.length ||
            words.some((w) =>
              `${l.title} ${l.description} ${l.category}`
                .toLowerCase()
                .includes(w),
            )),
      )
      .slice(0, 4);
    text = result.length
      ? `I found ${result.length} available options: ${result.map((l) => `${l.title} (${money(l.price)})`).join(", ")}.`
      : "No available listings match. Try a broader search.";
  } else if (name === "searchVendors" || name === "getVendor") {
    const ids = context.vendors
      .filter((v) =>
        name === "getVendor"
          ? v.id === args.vendorId
          : v.name.toLowerCase().includes((args.query as string).toLowerCase()),
      )
      .map((v) => v.id);
    result = catalog.filter((l) => ids.includes(l.vendorId)).slice(0, 4);
    text = result.length
      ? "These available listings come from the selected vendors."
      : "No available vendor listings match.";
  } else if (name === "getNearbyActivity") {
    result = catalog.slice(0, 4);
    text = `${context.vendors.length} active vendors and ${context.runners.filter((r) => r.until > Date.now()).length} available runners in this marketplace. Demo businesses are labeled on their cards.`;
  } else if (
    name === "getListingAvailability" ||
    name === "getListingDetails"
  ) {
    const l = listing(args.listingId);
    result = [l];
    text = `${l.title}: ${l.inventory} available at ${money(l.price)} each. ${l.description}`;
  } else if (name === "compareOptions") {
    result = [...new Set(args.listingIds as string[])].map(listing);
    text = result
      .map(
        (l) =>
          `${l.title}: ${money(l.price)}, ${l.mode}, ${l.inventory} available. ${l.description}`,
      )
      .join(" ");
  } else if (
    name === "findCompatibleRunners" ||
    name === "estimateFulfillment"
  ) {
    const l = listing(args.listingId);
    result = [l];
    const v = context.vendors.find((v) => v.id === l.vendorId)!;
    const matches = matchRunners(
      context.runners,
      v.coordinates,
      l.category,
      v.id,
    );
    const r = matches[0];
    matchedRunnerId = r?.id;
    text = r
      ? `${r.name} ${r.existingTrip ? "is already heading toward this vendor" : "is a compatible candidate"}. ${r.explanation} Workload: ${r.workload}/3. Availability is temporary; no precise road detour or delivery time is claimed. The runner must accept the assignment.`
      : "No currently available compatible runner was found.";
  } else if (name === "prepareOrder") {
    if (!context.authenticated)
      throw new HttpError("Sign in to prepare an order", 401);
    const l = listing(args.listingId);
    const quantity = args.quantity as number;
    if (quantity > l.inventory)
      throw new HttpError("Insufficient inventory", 409);
    result = [l];
    prepared = { listingId: l.id, quantity, totalCents: l.price * quantity };
    const vendor = context.vendors.find((v) => v.id === l.vendorId)!;
    const runner = matchRunners(
      context.runners,
      vendor.coordinates,
      l.category,
      vendor.id,
    )[0];
    matchedRunnerId = runner?.id;
    text = `Review ${quantity} × ${l.title} for ${money(prepared.totalCents)}. This is a quote only; inventory reservation and payment require your explicit approval. ${runner ? `${runner.name} ${runner.existingTrip ? "is already heading toward this vendor" : "is a compatible candidate"}; ${runner.explanation} The runner must accept.` : "No compatible runner is currently available."}`;
  } else if (name === "getOrderStatus") {
    if (!context.authenticated)
      throw new HttpError("Sign in to read order status", 401);
    const state = context.orders?.[args.orderId as string];
    if (!state) throw new HttpError("Order unavailable", 404);
    text = `Order status: ${state}. Payment status comes from the persisted server record.`;
  }
  return {
    text,
    listings: result,
    vendorIds: result.map((l) => l.vendorId),
    prepared,
    matchedRunnerId,
    source: "ai-tool",
    tools: [name],
  };
}
