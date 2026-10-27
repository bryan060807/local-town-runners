import "server-only";
import { authenticated, HttpError } from "./db";
import { demoEnabled, demoSession } from "./demo";
import { templateWorkspace } from "@/lib/demo-catalog";

export function rejectSimulatedPayment(order: { demo_simulated?: boolean }) {
  if (order.demo_simulated)
    throw new HttpError(
      "This is a simulated demo order. No PayPal payment or refund applies.",
      409,
    );
}

export async function demoOrderActor(role: "customer" | "vendor") {
  const { client, user, profile } = await authenticated();
  if (!profile.demo_workspace || profile.demo_workspace === templateWorkspace)
    throw new HttpError("Your own active Demo Mode session is required", 403);
  const [session, enabled] = await Promise.all([demoSession(), demoEnabled()]);
  if (
    !enabled ||
    !session ||
    session.workspace_id !== profile.demo_workspace ||
    session[`${role}_id`] !== user.id
  )
    throw new HttpError(
      `Switch to the ${role} in your own active demo session`,
      403,
    );
  return { client, user, session };
}
