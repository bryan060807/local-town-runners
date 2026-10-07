export type PublicRunner = {
  id: string;
  name: string;
  area: [number, number];
  availableUntil: number;
  destinationVendorId?: string;
  demo: boolean;
};
