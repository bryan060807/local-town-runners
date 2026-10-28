import { body, failure, sameOrigin } from "@/lib/server/http";
import { loadErrandContext } from "@/lib/server/errand-context";
import { planRequestSchema } from "@/lib/errand-plan";
import { planErrand } from "@/lib/errand-planner";
import { logEvent } from "@/lib/observability";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = await body(request, planRequestSchema);
    const initial = await loadErrandContext();
    const plan = await planErrand(
      input,
      initial.context,
      !initial.offline && process.env.AI_API_KEY && process.env.AI_MODEL
        ? {
            apiKey: process.env.AI_API_KEY,
            model: process.env.AI_MODEL,
            baseUrl: process.env.AI_BASE_URL,
          }
        : null,
      async () => (await loadErrandContext(false)).context,
    );
    logEvent("sidekick_plan_completed", {
      stage: plan.provenance.engine,
      outcome:
        plan.provenance.engine === "model"
          ? plan.provenance.modelAttempts === 2
            ? "validated_after_correction"
            : "validated"
          : "catalog_fallback",
    });
    return Response.json(plan);
  } catch (error) {
    return failure(error);
  }
}
