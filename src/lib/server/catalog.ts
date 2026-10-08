import "server-only";
import { logEvent } from "@/lib/observability";
import { safeAssetUrl, safeWebsiteUrl } from "@/lib/assets";
import { demoRunners } from "@/lib/runners";
import { PublicRunner } from "@/lib/map-types";
import { db } from "./db";
import { templateWorkspace } from "@/lib/demo-catalog";
import { supabaseConfig, configured } from "./env";
import {
  vendors as demoVendors,
  listings as demoListings,
  Vendor,
  Listing,
} from "@/lib/catalog";
export async function publicCatalog() {
  if (!configured())
    return {
      vendors: demoVendors,
      listings: demoListings,
      runners: demoRunners().map((r) => ({
        id: r.id,
        name: r.name,
        area: r.area,
        availableUntil: r.until,
        destinationVendorId: r.destinationVendorId,
        demo: true,
      })),
      demo: true,
    };
  const e = supabaseConfig();
  const c = await db(true);
  const v = await c
    .from("vendors")
    .select(
      "id,name,category,public_lon,public_lat,demo,verified,description,hours,website_url,social_urls,logo_url,cover_url,demo_workspace",
    )
    .eq("active", true);
  const vendorIds = (v.data || []).map((row) => row.id);
  const [l, r, t] = await Promise.all([
    vendorIds.length
      ? c
          .from("listings")
          .select(
            "id,vendor_id,title,description,category,mode,price_cents,inventory,made_local,active,emoji,photos,secondhand",
          )
          .eq("active", true)
          .eq("prohibited", false)
          .gt("inventory", 0)
          .in("vendor_id", vendorIds)
      : { data: [], error: null },
    c
      .from("runners")
      .select("id,display_name,public_lon,public_lat,available_until,demo")
      .eq("visible", true)
      .gt("available_until", new Date().toISOString()),
    vendorIds.length
      ? c
          .from("runner_trips")
          .select("runner_id,destination_vendor_id,expires_at")
          .order("expires_at", { ascending: false })
          .gt("expires_at", new Date().toISOString())
          .in("destination_vendor_id", vendorIds)
      : { data: [], error: null },
  ]);
  if (v.error || l.error || r.error || t.error) {
    logEvent("catalog_failure", {
      stage: "public_read",
      outcome: "unavailable",
    });
    throw Error("Marketplace data unavailable");
  }
  return {
    demo: false,
    isolatedDemo: Boolean(
      v.data?.length &&
      v.data[0].demo_workspace &&
      v.data[0].demo_workspace !== templateWorkspace &&
      v.data.every((row) => row.demo_workspace === v.data[0].demo_workspace),
    ),
    runners: r.data!.map((row) => ({
      id: row.id,
      name: row.display_name,
      area: [Number(row.public_lon), Number(row.public_lat)],
      availableUntil: Date.parse(row.available_until),
      destinationVendorId: t.data!.find((trip) => trip.runner_id === row.id)
        ?.destination_vendor_id,
      demo: row.demo,
    })) as PublicRunner[],
    vendors: v.data.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      coordinates: [Number(row.public_lon), Number(row.public_lat)],
      demo: row.demo,
      verified: row.verified,
      description: row.description,
      hours: Object.fromEntries(
        Object.entries(
          row.hours &&
            typeof row.hours === "object" &&
            !Array.isArray(row.hours)
            ? row.hours
            : {},
        )
          .filter(([, value]) => typeof value === "string")
          .slice(0, 14),
      ) as Record<string, string>,
      websiteUrl: safeWebsiteUrl(row.website_url),
      socialUrls: (row.social_urls || []).map(safeWebsiteUrl).filter(Boolean),
      logoUrl: safeAssetUrl(row.logo_url, e.url),
      coverUrl: safeAssetUrl(row.cover_url, e.url),
    })) as Vendor[],
    listings: l.data.map((row) => ({
      id: row.id,
      vendorId: row.vendor_id,
      title: row.title,
      description: row.description,
      category: row.category,
      mode: row.mode,
      price: Number(row.price_cents),
      inventory: row.inventory,
      local: row.made_local,
      secondhand: row.secondhand,
      active: row.active,
      emoji: row.emoji,
      photos: (row.photos || [])
        .map((url: string) => safeAssetUrl(url, e.url))
        .filter((url: unknown) => Boolean(url)),
    })) as Listing[],
  };
}
