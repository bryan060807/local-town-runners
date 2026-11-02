import "server-only";
import { createClient } from "@supabase/supabase-js";
import { safeAssetUrl } from "@/lib/assets";
import { logEvent } from "@/lib/observability";
import type {
  ShowcaseBusiness,
  ShowcaseListing,
  VendorShowcase,
} from "@/lib/vendor-showcase";
import { configured, supabaseConfig } from "./env";

const businessLimit = 6;
const listingLimit = 3;

/** Read the same published data an anonymous visitor can see, without cookies. */
export async function publicVendorShowcase(): Promise<VendorShowcase> {
  if (!configured())
    return { status: "disabled", businesses: [], hasMore: false };
  try {
    const config = supabaseConfig();
    const signal = AbortSignal.timeout(5000);
    // Never use db(), a logged-in client's bearer token or the service-role key.
    // This separate anonymous client preserves the existing public RLS boundary.
    const anonymous = createClient(config.url, config.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, cache: "no-store", redirect: "error" }),
      },
    });
    const vendors = await anonymous
      .from("vendors")
      .select("id,name,category,description,logo_url,cover_url")
      .eq("active", true)
      .eq("demo", false)
      .is("demo_workspace", null)
      .order("name")
      .order("id")
      .limit(businessLimit + 1)
      .abortSignal(signal);
    if (vendors.error) throw Error("Public showcase unavailable");
    const rows = vendors.data || [];
    const businesses = await Promise.all(
      rows
        .slice(0, businessLimit)
        .map(async (vendor): Promise<ShowcaseBusiness> => {
          const result = await anonymous
            .from("listings")
            .select("id,title,description,mode,price_cents,photos")
            .eq("vendor_id", vendor.id)
            .eq("active", true)
            .eq("prohibited", false)
            .gt("inventory", 0)
            .order("title")
            .order("id")
            .limit(listingLimit)
            .abortSignal(signal);
          if (result.error) throw Error("Public showcase listings unavailable");
          const listings = (result.data || []).flatMap(
            (row): ShowcaseListing[] => {
              const priceCents = Number(row.price_cents);
              if (
                !["SELL", "MAKE", "DO"].includes(row.mode) ||
                !Number.isSafeInteger(priceCents) ||
                priceCents < 0 ||
                (row.mode === "SELL" && priceCents === 0)
              )
                return [];
              const photoUrl = (Array.isArray(row.photos) ? row.photos : [])
                .map((url: unknown) => safeAssetUrl(url, config.url))
                .find((url: string | undefined) => Boolean(url));
              return [
                {
                  id: row.id,
                  title: row.title,
                  description: row.description || "",
                  mode: row.mode,
                  priceCents,
                  photoUrl,
                },
              ];
            },
          );
          return {
            id: vendor.id,
            name: vendor.name,
            category: vendor.category,
            description: vendor.description || "",
            photoUrl:
              safeAssetUrl(vendor.cover_url, config.url) ||
              safeAssetUrl(vendor.logo_url, config.url) ||
              listings.find((listing) => listing.photoUrl)?.photoUrl,
            listings,
          };
        }),
    );
    return {
      status: "ready",
      businesses,
      hasMore: rows.length > businessLimit,
    };
  } catch {
    logEvent("vendor_showcase_unavailable", {
      stage: "anonymous_public_read",
      outcome: "unavailable",
    });
    return { status: "unavailable", businesses: [], hasMore: false };
  }
}
