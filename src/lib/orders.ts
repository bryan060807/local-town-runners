import { z } from "zod";
export const prepareSchema = z
  .object({
    listingId: z.string().max(80),
    quantity: z.number().int().min(1).max(20),
  })
  .strict();
export const states = [
  "DRAFT",
  "PENDING_PAYMENT",
  "PAID",
  "VENDOR_ACCEPTED",
  "RUNNER_MATCHING",
  "RUNNER_ASSIGNED",
  "READY_FOR_PICKUP",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type OrderState = (typeof states)[number];
const next: Partial<Record<OrderState, OrderState[]>> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["PAID"],
  PAID: ["VENDOR_ACCEPTED"],
  VENDOR_ACCEPTED: ["RUNNER_MATCHING"],
  RUNNER_MATCHING: ["RUNNER_ASSIGNED"],
  RUNNER_ASSIGNED: ["READY_FOR_PICKUP"],
  READY_FOR_PICKUP: ["PICKED_UP"],
  PICKED_UP: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
};
export function transition(from: OrderState, to: OrderState) {
  if (!next[from]?.includes(to)) throw new Error("Invalid order transition");
  return to;
}
export function allocations(total: number) {
  if (!Number.isSafeInteger(total) || total < 0)
    throw new Error("Invalid money");
  const vendor = Math.floor((total * 80) / 100),
    runner = Math.floor((total * 15) / 100);
  return { vendor, runner, platform: total - vendor - runner };
}
export function canAccess(role: string, owner: string, user: string) {
  return role === "admin" || owner === user;
}
