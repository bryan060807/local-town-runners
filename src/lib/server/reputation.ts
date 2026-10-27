import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CommunityProgressStats,
  VendorReputationStats,
} from "@/lib/reputation";
import { logEvent } from "@/lib/observability";

function count(value: unknown): number {
  const number = Number(value);
  if (value == null || !Number.isSafeInteger(number) || number < 0)
    throw Error("Invalid reputation count");
  return number;
}

function rating(value: unknown, reviews: number): number | null {
  if (!reviews && value == null) return null;
  const number = Number(value);
  if (value == null || !Number.isFinite(number) || number < 1 || number > 5)
    throw Error("Invalid reputation rating");
  return number;
}

export async function vendorReputations(client: SupabaseClient, ids: string[]) {
  const stats = new Map<string, VendorReputationStats>();
  const unique = [...new Set(ids)];
  try {
    const batches = [];
    for (let index = 0; index < unique.length; index += 100)
      batches.push(unique.slice(index, index + 100));
    const results = await Promise.all(
      batches.map((vendorIds) =>
        client.rpc("vendor_reputation", { vendor_ids: vendorIds }),
      ),
    );
    for (const result of results) {
      if (result.error) throw Error("Reputation unavailable");
      for (const row of result.data || []) {
        const reviews = count(row.review_count);
        stats.set(row.vendor_id, {
          averageRating: rating(row.average_rating, reviews),
          reviewCount: reviews,
          completedOrders: count(row.completed_orders),
          ...(row.community_favorite === true
            ? { badge: "Community favorite" as const }
            : {}),
        });
      }
    }
  } catch {
    logEvent("reputation_unavailable", {
      stage: "vendor_aggregate",
      outcome: "unavailable",
    });
  }
  return stats;
}

export async function communityProgress(
  client: SupabaseClient,
): Promise<CommunityProgressStats | null> {
  try {
    const { data, error } = await client.rpc("my_community_progress");
    if (error || !data?.[0]) throw Error("Progress unavailable");
    const row = data[0];
    const vendorReviews = count(row.vendor_review_count);
    return {
      completedOrders: count(row.completed_orders),
      thoughtfulReviews: count(row.thoughtful_reviews),
      points: count(row.points),
      vendorCompletedOrders: count(row.vendor_completed_orders),
      vendorReviewCount: vendorReviews,
      vendorAverageRating: rating(row.vendor_average_rating, vendorReviews),
      demo: row.demo === true,
    };
  } catch {
    logEvent("reputation_unavailable", {
      stage: "private_progress",
      outcome: "unavailable",
    });
    return null;
  }
}
