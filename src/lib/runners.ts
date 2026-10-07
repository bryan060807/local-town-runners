export type Runner = {
  id: string;
  name: string;
  area: [number, number];
  until: number;
  categories: string[];
  maxDetour: number;
  destinationVendorId?: string;
  workload: number;
  reliability: number;
};
export function distanceMiles(a: [number, number], b: [number, number]) {
  const radians = (n: number) => (n * Math.PI) / 180;
  const dlat = radians(b[1] - a[1]),
    dlon = radians(b[0] - a[0]);
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(radians(a[1])) * Math.cos(radians(b[1])) * Math.sin(dlon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function matchRunners(
  runners: Runner[],
  pickup: [number, number],
  category: string,
  vendorId: string,
  now = Date.now(),
) {
  return runners
    .filter(
      (r) => r.until > now && r.categories.includes(category) && r.workload < 3,
    )
    .map((r) => {
      const miles = distanceMiles(r.area, pickup);
      const existingTrip = r.destinationVendorId === vendorId;
      return {
        ...r,
        approximateMiles: miles,
        existingTrip,
        score:
          (existingTrip ? 40 : 0) +
          r.reliability * 20 -
          miles * 8 -
          r.workload * 10,
      };
    })
    .filter((r) => r.approximateMiles <= r.maxDetour)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function demoRunners(now = Date.now()): Runner[] {
  return [
    {
      id: "bryan",
      name: "Bryan",
      area: [-91.05, 39.45],
      until: now + 3600000,
      categories: ["Food", "Shops", "Gifts"],
      maxDetour: 3,
      destinationVendorId: "vendor-1",
      workload: 0,
      reliability: 0.98,
    },
    {
      id: "sarah",
      name: "Sarah",
      area: [-91.06, 39.45],
      until: now + 5400000,
      categories: ["Food", "Farm", "Gifts", "Makers"],
      maxDetour: 4,
      workload: 1,
      reliability: 0.96,
    },
    {
      id: "jordan",
      name: "Jordan",
      area: [-91.05, 39.44],
      until: now + 1800000,
      categories: ["Shops", "Services"],
      maxDetour: 5,
      workload: 0,
      reliability: 0.95,
    },
  ];
}
