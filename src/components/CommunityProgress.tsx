import type { CommunityProgressStats } from "@/lib/reputation";
import styles from "./CommunityReputation.module.css";

export default function CommunityProgress({
  progress,
  customer,
  vendor,
}: {
  progress: CommunityProgressStats | null;
  customer: boolean;
  vendor: boolean;
}) {
  return (
    <>
      {customer && (
        <section className="simple-card community-progress">
          <h2>Your community progress</h2>
          {progress ? (
            <>
              {progress.demo && (
                <span className={styles.demo}>Fictional demo recognition</span>
              )}
              <strong className={styles.points}>
                {progress.points} community points
              </strong>
              <p>
                {progress.completedOrders} completed{" "}
                {progress.completedOrders === 1 ? "purchase" : "purchases"} ·{" "}
                {progress.thoughtfulReviews} thoughtful{" "}
                {progress.thoughtfulReviews === 1 ? "review" : "reviews"}
              </p>
              {progress.completedOrders > 0 && (
                <span className={styles.badge}>
                  {progress.completedOrders >= 10
                    ? "Community supporter"
                    : progress.completedOrders >= 5
                      ? "Regular neighbor"
                      : "First local purchase"}
                </span>
              )}
              <p>
                {progress.completedOrders >= 10
                  ? "Thank you for supporting your local community."
                  : `${Math.max(0, (progress.completedOrders >= 5 ? 10 : progress.completedOrders >= 1 ? 5 : 1) - progress.completedOrders)} more to reach your next purchase milestone.`}
              </p>
            </>
          ) : (
            <p>Community progress is temporarily unavailable.</p>
          )}
          <details>
            <summary>How recognition works</summary>
            <p>
              Earn 10 points for a paid purchase completed through the app, plus
              5 points for its review with at least 20 characters. Every star
              rating earns the same credit. Each order and review counts once;
              purchases from your own storefront do not count.
            </p>
            <p>
              Points and milestones are recognition only and have no cash value.
              Customer progress stays private. Demo activity is labeled
              separately.
            </p>
          </details>
          <details>
            <summary>Good neighbor buying habits</summary>
            <ul className={styles.habits}>
              <li>Keep payments and order status updates in the app.</li>
              <li>Confirm receipt before marking an order complete.</li>
              <li>Describe your experience honestly when you review.</li>
              <li>
                Use a listing’s report option if something needs attention.
              </li>
            </ul>
          </details>
        </section>
      )}
      {vendor && (
        <section className="simple-card vendor-progress">
          <h2>Your vendor reputation</h2>
          {progress ? (
            <>
              {progress.demo && (
                <span className={styles.demo}>Fictional demo recognition</span>
              )}
              <p>
                {progress.vendorCompletedOrders} fulfilled{" "}
                {progress.vendorCompletedOrders === 1 ? "order" : "orders"} ·{" "}
                {progress.vendorReviewCount} completed-order{" "}
                {progress.vendorReviewCount === 1 ? "review" : "reviews"}
              </p>
              {progress.vendorAverageRating !== null && (
                <strong>
                  {progress.vendorAverageRating.toFixed(1)} / 5 average across
                  your storefronts
                </strong>
              )}
            </>
          ) : (
            <p>Vendor reputation is temporarily unavailable.</p>
          )}
          <p>
            Each storefront earns Community favorite with reviews from at least
            five different customers and an average of 4.5 or higher. Paid
            placement is labeled separately and cannot award this badge.
          </p>
          <details>
            <summary>Good neighbor selling habits</summary>
            <ul className={styles.habits}>
              <li>Keep prices, photos and available inventory accurate.</li>
              <li>
                Accept orders you can fulfill and update pickup readiness.
              </li>
              <li>Keep private pickup details inside the app.</li>
              <li>
                Resolve concerns through the order’s refund and support flow.
              </li>
            </ul>
          </details>
        </section>
      )}
    </>
  );
}
