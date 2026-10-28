import {
  buildErrandPlan,
  catalogFallbackPlan,
  type ErrandPlan,
  type PlanProposal,
  type PlanRequest,
} from "./errand-plan";
import {
  boundedPlanContext,
  requestErrandProposal,
  type ErrandModelConfig,
  type ModelPlanContext,
  type PlanCorrection,
} from "./errand-model";

export type ValidatedErrandPlan = ErrandPlan & {
  provenance: ErrandPlan["provenance"] & { modelAttempts: number };
};

function correctionFor(
  proposal: PlanProposal,
  context: ModelPlanContext,
  request: PlanRequest,
): PlanCorrection {
  const budget = catalogFallbackPlan(
    context,
    request,
    "validation_feedback",
  ).budgetCents;
  return {
    rejectedProposal: proposal,
    instruction:
      "The server rejected this proposal. Revise it using these verified totals and the fresh current catalog. Every alternative must fit the entire item budget, stock, visibility and explicit preferences. Do not drop a specifically requested item silently. One distinct valid option is enough; ask a clarification or return no_match if the request cannot be met. Never claim a cart, reservation, payment or assignment.",
    maximumItemsTotalCents: budget ?? proposal.budgetCents,
    verifiedOptionTotals: proposal.options.map((option, optionIndex) => {
      const rows = option.items.map((item) => ({
        item,
        listing: context.listings.find(
          (listing) => listing.id === item.listingId,
        ),
      }));
      const total = rows.every((row) => row.listing)
        ? rows.reduce(
            (sum, row) => sum + row.listing!.price * row.item.quantity,
            0,
          )
        : null;
      return {
        optionIndex,
        subtotalCents: Number.isSafeInteger(total) ? total : null,
        allItemsPurchasable: rows.every(
          ({ listing, item }) =>
            listing?.active &&
            listing.mode === "SELL" &&
            listing.inventory >= item.quantity &&
            context.vendors.some((vendor) => vendor.id === listing.vendorId),
        ),
      };
    }),
  };
}

/** Read-only planning, with one optional correction for rejected domain facts. */
export async function planErrand(
  request: PlanRequest,
  initialContext: ModelPlanContext,
  config: ErrandModelConfig | null,
  refreshContext: () => Promise<ModelPlanContext>,
  fetcher: typeof fetch = fetch,
): Promise<ValidatedErrandPlan> {
  let context = initialContext;
  let offered = boundedPlanContext(context);
  let correction: PlanCorrection | undefined;
  const fallback = (reason: string, attempts: number): ValidatedErrandPlan => {
    const plan = catalogFallbackPlan(context, request, reason);
    return {
      ...plan,
      provenance: { ...plan.provenance, modelAttempts: attempts },
    };
  };
  if (!config?.apiKey || !config.model) return fallback("not_configured", 0);

  for (let attempt = 1; attempt <= 2; attempt++) {
    let generated: Awaited<ReturnType<typeof requestErrandProposal>>;
    try {
      generated = await requestErrandProposal(
        config,
        request,
        offered,
        fetcher,
        correction,
      );
    } catch {
      // Provider/auth/transport failures do not cause an automatic paid retry.
      return fallback("provider_unavailable", attempt);
    }
    context = await refreshContext();
    const offeredIds = new Set(offered.listings.map((listing) => listing.id));
    const currentOffered = {
      ...context,
      listings: context.listings.filter((listing) =>
        offeredIds.has(listing.id),
      ),
    };
    try {
      const plan = buildErrandPlan(
        generated.proposal,
        currentOffered,
        request,
        {
          engine: "model",
          model: generated.model,
          catalogCount: context.listings.length,
        },
      );
      return {
        ...plan,
        provenance: { ...plan.provenance, modelAttempts: attempt },
      };
    } catch {
      if (attempt === 2)
        return fallback("catalog_changed_or_invalid_plan", attempt);
      correction = correctionFor(generated.proposal, currentOffered, request);
      offered = boundedPlanContext(context);
    }
  }
  return fallback("catalog_changed_or_invalid_plan", 2);
}
