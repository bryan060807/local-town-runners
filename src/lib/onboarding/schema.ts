import { z } from "zod";
export const categories = [
  "Food",
  "Gifts",
  "Makers",
  "Farm",
  "Shops",
  "Services",
] as const;
const text = (max: number) => z.string().trim().min(2).max(max);
const common = {
  name: text(150),
  phone: text(40),
  serviceArea: text(150),
  description: text(2000),
};
export const product = z
  .object({
    title: text(150),
    description: text(2000),
    mode: z.enum(["SELL", "MAKE", "DO"]),
    priceCents: z.number().int().min(0).max(10000000),
    inventory: z.number().int().min(0).max(100000),
    availability: text(200),
    photos: z.array(z.uuid()).max(3).default([]),
  })
  .strict()
  .refine((p) => p.mode !== "SELL" || p.priceCents > 0, {
    message: "SELL products need a price",
  });
export const vendorPayload = z
  .object({
    ...common,
    representative: text(150),
    category: z.enum(categories),
    businessInfo: z.string().max(1000),
    products: z.array(product).min(1).max(10),
  })
  .strict();
export const runnerPayload = z
  .object({
    ...common,
    transportation: z.enum(["Walking", "Bicycle", "Car"]),
    availability: text(300),
    radius: z.number().min(1).max(50),
    maxDetour: z.number().min(0).max(50),
    travelAreas: text(300),
    pickupAreas: text(300),
    routePreferences: text(500),
    deliveryTypes: z.array(z.enum(categories)).min(1).max(6),
    eligibility: z.string().max(1000),
    locationConsent: z.literal(true),
  })
  .strict();
export const signatureSchema = z
  .array(
    z
      .array(
        z.tuple([
          z.number().finite().min(0).max(600),
          z.number().finite().min(0).max(200),
        ]),
      )
      .min(2)
      .max(150),
  )
  .min(1)
  .max(30)
  .refine((s) => s.flat().length <= 450, { message: "Signature too large" });
export const agreementSections = z
  .array(z.object({ heading: text(200), text: text(15000) }).strict())
  .min(2)
  .max(30);
