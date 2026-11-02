/** Public display-only records. These are deliberately not cart/AI catalog DTOs. */
export type ShowcaseListing = {
  id: string;
  title: string;
  description: string;
  mode: "SELL" | "MAKE" | "DO";
  priceCents: number;
  photoUrl?: string;
};

export type ShowcaseBusiness = {
  id: string;
  name: string;
  category: string;
  description: string;
  photoUrl?: string;
  listings: ShowcaseListing[];
};

export type VendorShowcase = {
  status: "ready" | "unavailable" | "disabled";
  businesses: ShowcaseBusiness[];
  hasMore: boolean;
};
