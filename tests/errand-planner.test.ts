import { test } from "node:test";
import assert from "node:assert/strict";
import type { Listing, Vendor } from "../src/lib/catalog";
import type { ModelPlanContext } from "../src/lib/errand-model";
import type { PlanProposal, PlanRequest } from "../src/lib/errand-plan";
import { planErrand } from "../src/lib/errand-planner";

const config = {
  apiKey: "test-only-key-not-a-credential",
  model: "test-planning-model",
  baseUrl: "https://model.example/v1/",
};
const request: PlanRequest = {
  message: "Suggest a local gift under $30 total from one shop.",
  turns: [],
  budgetCents: 3000,
  localOnly: true,
  singleVendor: true,
};
const vendor: Vendor = {
  id: "fictional-gift-shop",
  name: "Fictional Gift Shop",
  category: "Goods",
  coordinates: [-91.05, 39.45],
  demo: true,
};
function listing(id: string, price: number): Listing {
  return {
    id,
    vendorId: vendor.id,
    title: id === "mug" ? "Handmade Mug" : "Local Honey",
    description: "A fictional gift for a pure orchestration test.",
    category: "Goods",
    mode: "SELL",
    price,
    inventory: 5,
    local: true,
    active: true,
    emoji: "🎁",
  };
}
function context(): ModelPlanContext {
  return {
    authenticated: true,
    vendors: [vendor],
    listings: [listing("mug", 2800), listing("honey", 1800)],
    runners: [],
    orders: { "existing-order": "PRESERVE_EXISTING_ORDER" },
  };
}
function proposal(ids = ["honey"]): PlanProposal {
  return {
    status: "recommend",
    understoodNeed: "A local gift within the $30 item budget.",
    budgetCents: 3000,
    localOnly: true,
    singleVendor: true,
    question: null,
    options: [
      {
        items: ids.map((listingId) => ({ listingId, quantity: 1 })),
        reasonCodes: ["WITHIN_BUDGET", "ONE_SHOP"],
      },
    ],
    recommendedIndex: 0,
  };
}
function completion(value: PlanProposal) {
  return new Response(
    JSON.stringify({
      model: "test-model-verified-version",
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  name: "buildLocalPlan",
                  arguments: JSON.stringify(value),
                },
              },
            ],
          },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
function requestData(init?: RequestInit) {
  const body = JSON.parse(String(init?.body));
  assert.equal(init?.method, "POST");
  assert.deepEqual(
    body.tools.map(
      (tool: { function: { name: string } }) => tool.function.name,
    ),
    ["buildLocalPlan"],
  );
  assert.deepEqual(body.tool_choice, {
    type: "function",
    function: { name: "buildLocalPlan" },
  });
  assert.equal(body.parallel_tool_calls, false);
  return JSON.parse(body.messages[1].content);
}

test("a valid first proposal uses one model call and current canonical catalog facts", async () => {
  const initial = context();
  const before = structuredClone(initial);
  const fresh = context();
  fresh.listings[1].price = 1900;
  let calls = 0;
  let refreshes = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    calls++;
    assert.equal(requestData(init).correction, undefined);
    return completion(proposal());
  };
  const result = await planErrand(
    request,
    initial,
    config,
    async () => {
      refreshes++;
      return fresh;
    },
    fetcher,
  );
  assert.equal(calls, 1);
  assert.equal(refreshes, 1);
  assert.equal(result.status, "recommend");
  assert.deepEqual(result.provenance, {
    engine: "model",
    model: "test-model-verified-version",
    modelAttempts: 1,
  });
  assert.equal(result.options[0].subtotalCents, 1900);
  assert.equal(result.options[0].items[0].lineTotalCents, 1900);
  assert.equal(result.options[0].items[0].listing.price, 1900);
  assert.equal(result.options[0].vendorGroups[0].subtotalCents, 1900);
  assert.deepEqual(initial, before);
});

test("one bounded correction receives verified $46 totals and returns a validated $18 gift", async () => {
  let calls = 0;
  let refreshes = 0;
  const initial = context();
  const before = structuredClone(initial);
  const rejected = proposal(["mug", "honey"]);
  const fetcher: typeof fetch = async (_url, init) => {
    const input = requestData(init);
    calls++;
    if (calls === 1) {
      assert.equal(input.correction, undefined);
      return completion(rejected);
    }
    assert.equal(calls, 2, "model corrections have a strict cost bound");
    assert.equal(input.correction.maximumItemsTotalCents, 3000);
    assert.deepEqual(input.correction.verifiedOptionTotals, [
      { optionIndex: 0, subtotalCents: 4600, allItemsPurchasable: true },
    ]);
    assert.deepEqual(input.correction.rejectedProposal, rejected);
    assert.equal(
      input.currentCatalog.find((item: { id: string }) => item.id === "honey")
        .priceCents,
      1800,
    );
    assert.ok(!JSON.stringify(input).includes("PRESERVE_EXISTING_ORDER"));
    return completion(proposal());
  };
  const result = await planErrand(
    request,
    initial,
    config,
    async () => {
      refreshes++;
      return context();
    },
    fetcher,
  );
  assert.equal(calls, 2);
  assert.equal(refreshes, 2);
  assert.equal(result.status, "recommend");
  assert.equal(result.provenance.engine, "model");
  assert.equal(result.provenance.model, "test-model-verified-version");
  assert.equal(result.provenance.modelAttempts, 2);
  assert.equal(result.options[0].subtotalCents, 1800);
  assert.deepEqual(
    result.options[0].items.map((item) => item.listing.id),
    ["honey"],
  );
  assert.deepEqual(initial, before);
});

test("two invalid proposals stop with honest catalog suggestions and no model badge", async () => {
  let calls = 0;
  let refreshes = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    calls++;
    requestData(init);
    assert.ok(calls <= 2);
    return completion(proposal(["mug", "honey"]));
  };
  const result = await planErrand(
    request,
    context(),
    config,
    async () => {
      refreshes++;
      return context();
    },
    fetcher,
  );
  assert.equal(calls, 2);
  assert.equal(refreshes, 2);
  assert.equal(result.status, "catalog");
  assert.deepEqual(result.options, []);
  assert.equal(result.recommendedIndex, null);
  assert.deepEqual(result.provenance, {
    engine: "catalog",
    reason: "catalog_changed_or_invalid_plan",
    modelAttempts: 2,
  });
  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions.every((item) => item.price <= 3000));
  assert.match(result.notes.join(" "), /not an AI-generated plan/);
});

test("provider authentication, rate-limit and timeout failures never cause a correction or fresh read", async () => {
  for (const failure of [401, 429, "timeout"] as const) {
    let calls = 0;
    let refreshes = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      if (failure === "timeout")
        throw new DOMException("PRIVATE_PROVIDER_PAYLOAD", "AbortError");
      return new Response("PRIVATE_PROVIDER_PAYLOAD " + config.apiKey, {
        status: failure,
      });
    };
    const result = await planErrand(
      request,
      context(),
      config,
      async () => {
        refreshes++;
        return context();
      },
      fetcher,
    );
    assert.equal(calls, 1, String(failure));
    assert.equal(refreshes, 0, String(failure));
    assert.equal(result.status, "catalog");
    assert.deepEqual(result.provenance, {
      engine: "catalog",
      reason: "provider_unavailable",
      modelAttempts: 1,
    });
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes("PRIVATE_PROVIDER_PAYLOAD"));
    assert.ok(!serialized.includes(config.apiKey));
    assert.deepEqual(result.options, []);
  }
});

test("fresh stock and offered scope are checked before publishing each model proposal", async () => {
  for (const change of ["stock", "visibility", "unoffered"] as const) {
    const initial = context();
    const fresh = context();
    let firstId = "mug";
    if (change === "stock") fresh.listings[0].inventory = 0;
    if (change === "visibility") fresh.listings.shift();
    if (change === "unoffered") {
      firstId = "not-in-first-offer";
      fresh.listings.push(listing(firstId, 100));
    }
    let calls = 0;
    let refreshes = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      calls++;
      const input = requestData(init);
      if (calls === 1) {
        assert.ok(
          !input.currentCatalog.some(
            (item: { id: string }) => item.id === "not-in-first-offer",
          ),
        );
        return completion(proposal([firstId]));
      }
      assert.equal(calls, 2);
      assert.ok(input.correction);
      assert.deepEqual(input.correction.verifiedOptionTotals, [
        {
          optionIndex: 0,
          subtotalCents: change === "stock" ? 2800 : null,
          allItemsPurchasable: false,
        },
      ]);
      return completion(proposal());
    };
    const result = await planErrand(
      request,
      initial,
      config,
      async () => {
        refreshes++;
        return fresh;
      },
      fetcher,
    );
    assert.equal(calls, 2, change);
    assert.equal(refreshes, 2, change);
    assert.equal(result.provenance.modelAttempts, 2, change);
    assert.equal(result.status, "recommend", change);
    assert.deepEqual(
      result.options[0].items.map((item) => item.listing.id),
      ["honey"],
      change,
    );
  }
});

test("authorization failures during either fresh read propagate rather than becoming catalog results", async () => {
  for (const failRefresh of [1, 2]) {
    const authorizationError = new Error("session authorization revoked");
    let calls = 0;
    let refreshes = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      return completion(
        failRefresh === 2 && calls === 1
          ? proposal(["mug", "honey"])
          : proposal(),
      );
    };
    await assert.rejects(
      planErrand(
        request,
        context(),
        config,
        async () => {
          refreshes++;
          if (refreshes === failRefresh) throw authorizationError;
          return context();
        },
        fetcher,
      ),
      (error: unknown) => error === authorizationError,
    );
    assert.equal(calls, failRefresh);
    assert.equal(refreshes, failRefresh);
  }
});

test("missing AI configuration returns truthful catalog suggestions without requests or fresh reads", async () => {
  for (const missing of [
    null,
    { ...config, apiKey: "" },
    { ...config, model: "" },
  ]) {
    let calls = 0;
    let refreshes = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      return completion(proposal());
    };
    const result = await planErrand(
      request,
      context(),
      missing,
      async () => {
        refreshes++;
        return context();
      },
      fetcher,
    );
    assert.equal(calls, 0);
    assert.equal(refreshes, 0);
    assert.equal(result.status, "catalog");
    assert.deepEqual(result.provenance, {
      engine: "catalog",
      reason: "not_configured",
      modelAttempts: 0,
    });
    assert.deepEqual(result.options, []);
    assert.ok(result.suggestions.length > 0);
  }
});
