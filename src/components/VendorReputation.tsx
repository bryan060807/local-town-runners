import type { VendorReputationStats } from "@/lib/reputation";
import styles from "./CommunityReputation.module.css";

export default function VendorReputation({
  reputation,
  demo = false,
}: {
  reputation?: VendorReputationStats;
  demo?: boolean;
}) {
  return (
    <div className={styles.reputation}>
      {demo && <span className={styles.demo}>Demo reputation</span>}
      {!reputation ? (
        <span>Ratings temporarily unavailable.</span>
      ) : (
        <>
          {reputation.reviewCount > 0 && reputation.averageRating !== null ? (
            <>
              <strong>
                <span aria-hidden="true">★ </span>
                {reputation.averageRating.toFixed(1)} / 5
              </strong>
              <span>
                {reputation.reviewCount} completed-order{" "}
                {reputation.reviewCount === 1 ? "review" : "reviews"}
              </span>
            </>
          ) : (
            <span>No completed-order reviews yet</span>
          )}
          {reputation.completedOrders > 0 && (
            <span>
              {reputation.completedOrders} fulfilled{" "}
              {reputation.completedOrders === 1 ? "order" : "orders"}
            </span>
          )}
          {reputation.badge && (
            <span
              className={styles.badge}
              title="At least five distinct completed-order reviewers and an average rating of 4.5 or higher."
            >
              {reputation.badge}
            </span>
          )}
        </>
      )}
    </div>
  );
}
