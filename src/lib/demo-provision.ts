import { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import {
  demoAddress,
  demoNames,
  demoProducts,
  demoRoles,
  demoShops,
  DemoRole,
} from "./demo-catalog";
type Client = SupabaseClient;
export type DemoCredentials = Record<
  DemoRole,
  { id: string; email: string; password: string }
>;
async function checked<T extends { error: unknown }>(p: PromiseLike<T>) {
  const r = await p;
  if (r.error) throw r.error;
  return r;
}
/** Service-side only. No roles or target user IDs are accepted from a browser. */
export async function provisionDemo(
  c: Client,
  workspaceId: string,
  template = false,
): Promise<DemoCredentials> {
  let createdWorkspace = false;
  const ids: string[] = [];
  const credentials = {} as DemoCredentials;
  try {
    await checked(
      c.from("demo_workspaces").insert({
        id: workspaceId,
        is_template: template,
        expires_at: new Date(
          Date.now() + (template ? 365 * 86400000 : 6 * 3600000),
        ).toISOString(),
      }),
    );
    createdWorkspace = true;
    for (const role of demoRoles) {
      const email = `${role}-${workspaceId}@ltr-demo.example`,
        password = randomBytes(32).toString("base64url");
      const r = await c.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (r.error || !r.data.user)
        throw r.error || Error("Demo account provisioning failed");
      const id = r.data.user.id;
      ids.push(id);
      credentials[role] = { id, email, password };
      await checked(
        c
          .from("profiles")
          .update({
            display_name: demoNames[role],
            demo_workspace: workspaceId,
          })
          .eq("id", id),
      );
      await checked(c.from("user_roles").delete().eq("user_id", id));
      await checked(c.from("user_roles").insert({ user_id: id, role }));
    }
    const shopIds: string[] = [];
    for (const shop of demoShops) {
      const id = randomUUID();
      shopIds.push(id);
      await checked(
        c.from("vendors").insert({
          id,
          owner_id: credentials.vendor.id,
          name: shop.name,
          slug: `demo-${workspaceId}-${shopIds.length}`,
          category: shop.category,
          description: shop.description,
          cover_url: shopIds.length === 1 ? "/demo/riverbend-cover.webp" : null,
          public_lon: shop.coordinates[0],
          public_lat: shop.coordinates[1],
          demo: true,
          verified: false,
          demo_workspace: workspaceId,
          hours: { Demo: "Fictional availability only" },
          service_area: "Louisiana, Missouri (demo)",
        }),
      );
      await checked(
        c.from("vendor_private").insert({
          vendor_id: id,
          pickup_address: "DEMO PICKUP POINT — fictional, no real residence",
          pickup_lon: null,
          pickup_lat: null,
        }),
      );
    }
    await checked(
      c.from("listings").insert(
        demoProducts.map((p) => ({
          id: randomUUID(),
          vendor_id: shopIds[p.shop],
          title: p.title,
          description: p.description,
          category: p.category,
          mode: p.mode,
          price_cents: p.price,
          inventory: p.inventory,
          demo_stock: p.inventory,
          made_local: p.local,
          secondhand: p.secondhand,
          emoji: p.emoji,
        })),
      ),
    );
    await checked(
      c.from("runners").insert({
        id: credentials.runner.id,
        display_name: demoNames.runner,
        demo: true,
        bio: "Fictional demo runner. Already heading toward the downtown Louisiana area.",
        public_lon: -91.05,
        public_lat: 39.45,
        available_until: new Date(Date.now() + 3600000).toISOString(),
        categories: ["Food", "Gifts", "Makers", "Farm", "Shops", "Services"],
        max_detour_miles: 3,
        visible: true,
        transportation: "Bicycle (demo)",
      }),
    );
    await checked(
      c.from("runner_trips").insert({
        runner_id: credentials.runner.id,
        destination_vendor_id: shopIds[0],
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        note: "Already heading toward the downtown Louisiana area. Fictional demo trip.",
      }),
    );
    await checked(
      c.from("customer_preferences").insert({
        customer_id: credentials.customer.id,
        delivery_address: demoAddress,
        delivery_notes: "Fictional test delivery; no real address or goods.",
      }),
    );
    await checked(
      c.from("audit_events").insert({
        event: template ? "DEMO_TEMPLATE_CREATED" : "ISOLATED_DEMO_CREATED",
        resource_id: workspaceId,
      }),
    );
    return credentials;
  } catch (e) {
    if (!createdWorkspace) throw e;
    // Remove only this failed, newly-created workspace; never touch existing customers.
    const v = await c
      .from("vendors")
      .select("id")
      .eq("demo_workspace", workspaceId);
    const vendorIds = (v.data || []).map((x) => x.id);
    if (vendorIds.length) {
      await c
        .from("runner_trips")
        .delete()
        .in("destination_vendor_id", vendorIds);
      await c.from("listings").delete().in("vendor_id", vendorIds);
      await c.from("vendors").delete().in("id", vendorIds);
    }
    for (const id of ids) {
      await c.from("customer_preferences").delete().eq("customer_id", id);
      await c.from("runners").delete().eq("id", id);
      await c.auth.admin.deleteUser(id);
    }
    await c.from("demo_workspaces").delete().eq("id", workspaceId);
    throw e;
  }
}
