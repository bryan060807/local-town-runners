import { z } from "zod";
import { type Listing, type Vendor, money } from "./catalog";
import type { ToolContext } from "./ai-tools";
import { type Runner, matchRunners } from "./runners";

const maxMoney = 10000000;
const moneySchema = z.number().int().min(0).max(maxMoney);
const shortText = z.string().trim().min(1).max(200);
export const planRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(1000),
    turns: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().trim().min(1).max(1000),
          })
          .strict(),
      )
      .max(6)
      .default([]),
    budgetCents: moneySchema.optional(),
    localOnly: z.boolean().optional(),
    singleVendor: z.boolean().optional(),
  })
  .strict();

const reasonSchema = z.enum([
  "WITHIN_BUDGET",
  "MADE_LOCAL",
  "ONE_SHOP",
  "CURRENT_TRIP",
]);
export const planProposalSchema = z
  .object({
    status: z.enum(["recommend", "clarify", "no_match"]),
    understoodNeed: shortText,
    budgetCents: moneySchema.nullable(),
    localOnly: z.boolean(),
    singleVendor: z.boolean(),
    question: shortText.nullable(),
    options: z
      .array(
        z
          .object({
            items: z
              .array(
                z
                  .object({
                    listingId: z.string().min(1).max(80),
                    quantity: z.number().int().min(1).max(20),
                  })
                  .strict(),
              )
              .min(1)
              .max(4),
            reasonCodes: z.array(reasonSchema).max(4),
          })
          .strict(),
      )
      .max(3),
    recommendedIndex: z.number().int().min(0).max(2).nullable(),
  })
  .strict();

export type PlanRequest = z.infer<typeof planRequestSchema>;
export type PlanProposal = z.infer<typeof planProposalSchema>;
type PlanContext = Omit<ToolContext, "runners"> & {
  runners: Array<Runner & { tripExpiresAt?: number }>;
};
type PlanMeta = {
  engine: "model" | "catalog";
  model?: string;
  reason?: string;
  catalogCount?: number;
};
type Pickup = {
  status: "declared_trip" | "candidate" | "none";
  runnerName?: string;
  validUntil?: number;
};
export type ErrandPlan = {
  status: "recommend" | "clarify" | "no_match" | "catalog";
  understoodNeed: string;
  question?: string;
  budgetCents: number | null;
  constraints: { localOnly: boolean; singleVendor: boolean };
  options: Array<{
    id: string;
    items: Array<{
      listing: Listing;
      quantity: number;
      lineTotalCents: number;
    }>;
    subtotalCents: number;
    vendorGroups: Array<{
      vendor: Vendor;
      subtotalCents: number;
      pickup: Pickup;
    }>;
    reasons: string[];
  }>;
  recommendedIndex: number | null;
  provenance: { engine: "model" | "catalog"; model?: string; reason?: string };
  catalogCount: number;
  catalogCompared: number;
  suggestions: Listing[];
  notes: string[];
};

/** Only explicit numeric user language can independently corroborate a budget. */
function textBudget(text: string): number | null {
  const amount = "(\\d+(?:,\\d{3})*(?:\\.\\d{1,2})?)";
  const patterns = [
    new RegExp(
      `(?:budget(?:\\s+(?:of|is|around|about))?\\s*:?|under|less than|at most|no more than|up to|maximum|max|limit|spend(?:ing)?)\\s*\\$?\\s*${amount}(?!\\d|\\.\\d)`,
      "gi",
    ),
    new RegExp(
      `(?:I|we)\\s+(?:have|can spend|want to spend)\\s+\\$\\s*${amount}(?!\\d|\\.\\d)`,
      "gi",
    ),
    new RegExp(
      `\\$\\s*${amount}\\s*(?:USD\\s*)?(?:budget|maximum|max|limit|total|or less|or under)\\b`,
      "gi",
    ),
  ];
  const bounds: number[] = [];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const suffix = text.slice((match.index ?? 0) + match[0].length);
      if (
        /^\s*(?:items?|units?|people|persons?|shops?|vendors?|minutes?|hours?|miles?)\b/i.test(
          suffix,
        )
      )
        continue;
      const multiplier = /^\s*cents?\b/i.test(suffix) ? 1 : 100;
      const cents = Math.round(
        Number(match[1].replaceAll(",", "")) * multiplier,
      );
      if (Number.isSafeInteger(cents) && cents >= 0)
        bounds.push(Math.min(cents, maxMoney));
    }
  }
  return bounds.length ? Math.min(...bounds) : null;
}

function userBudget(request: PlanRequest): number | null {
  const current = [
    ...request.turns
      .filter((turn) => turn.role === "user")
      .map((turn) => turn.text),
    request.message,
  ];
  const latest = current
    .reverse()
    .map(textBudget)
    .find((budget) => budget !== null);
  const bounds = [request.budgetCents, latest].filter(
    (value): value is number => value !== undefined && value !== null,
  );
  return bounds.length ? Math.min(...bounds) : null;
}

function catalogSnapshot(context: PlanContext, meta: PlanMeta) {
  const compared = context.listings.slice(0, 100);
  const count = Number.isSafeInteger(meta.catalogCount)
    ? Math.max(meta.catalogCount!, compared.length)
    : context.listings.length;
  const eligible = compared.filter(
    (listing) =>
      listing.active &&
      listing.mode === "SELL" &&
      Number.isSafeInteger(listing.inventory) &&
      listing.inventory > 0 &&
      Number.isSafeInteger(listing.price) &&
      listing.price >= 0 &&
      listing.price <= maxMoney &&
      context.vendors.some((vendor) => vendor.id === listing.vendorId),
  );
  return { compared, count, eligible };
}

function pickupFor(
  context: PlanContext,
  vendor: Vendor,
  categories: string[],
  now: number,
): Pickup {
  const runners = context.runners.map((runner) => ({
    ...runner,
    destinationVendorId:
      Number.isFinite(runner.tripExpiresAt) && runner.tripExpiresAt! > now
        ? runner.destinationVendorId
        : undefined,
  }));
  const matches = categories.map((category) =>
    matchRunners(runners, vendor.coordinates, category, vendor.id, now),
  );
  const runner = matches[0]?.find((candidate) =>
    matches.every((group) => group.some((match) => match.id === candidate.id)),
  );
  if (!runner) return { status: "none" };
  const tripExpiresAt = context.runners.find(
    (entry) => entry.id === runner.id,
  )?.tripExpiresAt;
  return {
    status: runner.existingTrip ? "declared_trip" : "candidate",
    runnerName: runner.name,
    validUntil: runner.existingTrip
      ? Math.min(runner.until, tripExpiresAt!)
      : runner.until,
  };
}

function notesFor(
  count: number,
  compared: number,
  explicitBudget: boolean,
  budget: number | null,
  hasFood: boolean,
) {
  const notes = [
    "Prices and stock are a current catalog snapshot. Review them again before preparing an order.",
    "Item totals are not a delivery quote. Pickup candidates are temporary and must accept; no road ETA or delivery guarantee is quoted.",
  ];
  if (budget !== null)
    notes.push(
      explicitBudget
        ? "The item budget comes from your explicit request or budget control."
        : "AI interpreted this item budget; review it before acting.",
    );
  if (hasFood)
    notes.push(
      "Confirm food portions, ingredients and dietary suitability with the vendor.",
    );
  if (count > compared)
    notes.push(
      `This comparison uses ${compared} of ${count} visible catalog listings; it is not an exhaustive marketplace search.`,
    );
  return notes;
}

export function buildErrandPlan(
  value: unknown,
  context: PlanContext,
  requestValue: PlanRequest,
  meta: PlanMeta,
  now = Date.now(),
): ErrandPlan {
  const request = planRequestSchema.parse(requestValue);
  const proposal = planProposalSchema.parse(value);
  const snapshot = catalogSnapshot(context, meta);
  const hardBudget = userBudget(request);
  const budget = hardBudget ?? proposal.budgetCents;
  const localOnly = request.localOnly ?? proposal.localOnly;
  const singleVendor = request.singleVendor ?? proposal.singleVendor;
  if (proposal.status === "recommend") {
    if (
      !proposal.options.length ||
      proposal.recommendedIndex === null ||
      proposal.recommendedIndex >= proposal.options.length ||
      proposal.question !== null
    )
      throw Error("Invalid recommendation structure");
  } else if (
    proposal.options.length ||
    proposal.recommendedIndex !== null ||
    (proposal.status === "clarify" && !proposal.question)
  )
    throw Error("Invalid clarification or no-match structure");

  const validatedOptions = proposal.options.map((option, index) => {
    const ids = new Set<string>();
    const items = option.items.map((item) => {
      if (ids.has(item.listingId)) throw Error("Duplicate plan item");
      ids.add(item.listingId);
      const listing = snapshot.eligible.find(
        (listing) => listing.id === item.listingId,
      );
      if (!listing) throw Error("Plan item is unavailable in this catalog");
      if (item.quantity > listing.inventory)
        throw Error("Plan quantity exceeds current stock");
      if (localOnly && !listing.local)
        throw Error("Plan does not meet the local-only constraint");
      const lineTotalCents = listing.price * item.quantity;
      if (!Number.isSafeInteger(lineTotalCents))
        throw Error("Invalid item total");
      return { listing, quantity: item.quantity, lineTotalCents };
    });
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.lineTotalCents,
      0,
    );
    if (
      !Number.isSafeInteger(subtotalCents) ||
      (budget !== null && subtotalCents > budget)
    )
      throw Error("Plan exceeds the item budget");
    const vendorIds = [...new Set(items.map((item) => item.listing.vendorId))];
    if (singleVendor && vendorIds.length !== 1)
      throw Error("Plan requires more than one shop");
    const vendorGroups = vendorIds.map((id) => {
      const group = items.filter((item) => item.listing.vendorId === id);
      if (group.reduce((sum, item) => sum + item.quantity, 0) > 20)
        throw Error("Vendor orders are limited to twenty units");
      const vendor = context.vendors.find((vendor) => vendor.id === id)!;
      return {
        vendor,
        subtotalCents: group.reduce(
          (sum, item) => sum + item.lineTotalCents,
          0,
        ),
        pickup: pickupFor(
          context,
          vendor,
          [...new Set(group.map((item) => item.listing.category))],
          now,
        ),
      };
    });
    const facts: Partial<Record<z.infer<typeof reasonSchema>, string>> = {};
    if (budget !== null)
      facts.WITHIN_BUDGET = `Within your ${money(budget)} item budget.`;
    if (items.every((item) => item.listing.local))
      facts.MADE_LOCAL =
        "Every selected item is marked made locally in the catalog.";
    if (vendorGroups.length === 1)
      facts.ONE_SHOP = "All selected items come from one shop.";
    if (vendorGroups.every((group) => group.pickup.status === "declared_trip"))
      facts.CURRENT_TRIP =
        "Each shop has a current declared-trip candidate who must accept.";
    const reasons = [...new Set(option.reasonCodes)].flatMap((code) =>
      facts[code] ? [facts[code]!] : [],
    );
    return {
      id: `option-${index + 1}`,
      items,
      subtotalCents,
      vendorGroups,
      reasons,
    };
  });
  // Validate every proposed option before normalizing harmless repetition.
  // Model output sometimes repeats an otherwise valid recommendation.
  const signatures = new Map<string, number>();
  const originalToCanonical: number[] = [];
  const options: ErrandPlan["options"] = [];
  for (const option of validatedOptions) {
    const signature = JSON.stringify(
      option.items
        .map((item) => [item.listing.id, item.quantity] as const)
        .sort(([first], [second]) => first.localeCompare(second)),
    );
    let canonical = signatures.get(signature);
    if (canonical === undefined) {
      canonical = options.length;
      signatures.set(signature, canonical);
      options.push({ ...option, id: `option-${canonical + 1}` });
    }
    originalToCanonical.push(canonical);
  }
  return {
    status: proposal.status,
    understoodNeed: proposal.understoodNeed,
    ...(proposal.question ? { question: proposal.question } : {}),
    budgetCents: budget,
    constraints: { localOnly, singleVendor },
    options,
    recommendedIndex:
      proposal.recommendedIndex === null
        ? null
        : originalToCanonical[proposal.recommendedIndex]!,
    provenance: {
      engine: meta.engine,
      ...(meta.model ? { model: meta.model } : {}),
      ...(meta.reason ? { reason: meta.reason } : {}),
    },
    catalogCount: snapshot.count,
    catalogCompared: snapshot.compared.length,
    suggestions: [],
    notes: notesFor(
      snapshot.count,
      snapshot.compared.length,
      hardBudget !== null,
      budget,
      options.some((option) =>
        option.items.some((item) => item.listing.category === "Food"),
      ),
    ),
  };
}

export function catalogFallbackPlan(
  context: PlanContext,
  requestValue: PlanRequest,
  reason: string,
): ErrandPlan {
  const request = planRequestSchema.parse(requestValue);
  const snapshot = catalogSnapshot(context, { engine: "catalog" });
  const budgetCents = userBudget(request);
  const suggestions = snapshot.eligible
    .filter(
      (listing) =>
        (budgetCents === null || listing.price <= budgetCents) &&
        (!request.localOnly || listing.local),
    )
    .slice(0, 4);
  return {
    status: "catalog",
    understoodNeed: "Current catalog suggestions",
    budgetCents,
    constraints: {
      localOnly: request.localOnly ?? false,
      singleVendor: request.singleVendor ?? false,
    },
    options: [],
    recommendedIndex: null,
    provenance: { engine: "catalog", reason },
    catalogCount: snapshot.count,
    catalogCompared: snapshot.compared.length,
    suggestions,
    notes: [
      "AI planning is unavailable right now. These are catalog suggestions, not an AI-generated plan.",
      ...notesFor(
        snapshot.count,
        snapshot.compared.length,
        budgetCents !== null,
        budgetCents,
        suggestions.some((listing) => listing.category === "Food"),
      ),
    ],
  };
}
