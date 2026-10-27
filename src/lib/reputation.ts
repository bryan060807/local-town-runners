export type VendorReputationStats = {
  averageRating: number | null;
  reviewCount: number;
  completedOrders: number;
  badge?: "Community favorite";
};

export type CommunityProgressStats = {
  completedOrders: number;
  thoughtfulReviews: number;
  points: number;
  vendorCompletedOrders: number;
  vendorReviewCount: number;
  vendorAverageRating: number | null;
  demo: boolean;
};
