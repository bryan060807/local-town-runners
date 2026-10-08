export function validCapture(capture: unknown, total: number) {
  const c = capture as {
    status?: string;
    amount?: { currency_code?: string; value?: string };
  };
  return (
    c?.status === "COMPLETED" &&
    c.amount?.currency_code === "USD" &&
    c.amount?.value === (total / 100).toFixed(2)
  );
}
export function paymentMatchesOrder(
  payment: unknown,
  orderId: string,
  paypalId: string,
) {
  const p = payment as {
    id?: string;
    purchase_units?: { custom_id?: string }[];
  };
  return (
    p?.id === paypalId &&
    p.purchase_units?.length === 1 &&
    p.purchase_units[0].custom_id === orderId
  );
}
export function validWebhookCertificate(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      [
        "api.paypal.com",
        "api.sandbox.paypal.com",
        "api-m.paypal.com",
        "api-m.sandbox.paypal.com",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Verify association before invoking a financial operation, then validate canonical proof. */
export async function reconcileOwnedCapture(
  order: { id: string; paypalId: string; totalCents: number },
  services: { read: () => Promise<unknown>; capture: () => Promise<unknown> },
) {
  let payment = await services.read();
  if (
    !paymentMatchesOrder(payment, order.id, order.paypalId) ||
    !paymentMatchesTotal(payment, order.totalCents)
  )
    throw Error("Payment order mismatch");
  if ((payment as { status?: string }).status !== "COMPLETED")
    payment = await services.capture();
  const p = payment as {
    purchase_units?: { payments?: { captures?: { id?: string }[] } }[];
  };
  const capture = p.purchase_units?.[0]?.payments?.captures?.[0];
  if (
    !paymentMatchesOrder(payment, order.id, order.paypalId) ||
    !validCapture(capture, order.totalCents) ||
    typeof capture?.id !== "string" ||
    !capture.id ||
    capture.id.length > 100
  )
    throw Error("Payment not confirmed");
  return capture.id;
}

export function paymentMatchesTotal(payment: unknown, total: number) {
  const p = payment as {
    purchase_units?: { amount?: { currency_code?: string; value?: string } }[];
  };
  return (
    p?.purchase_units?.length === 1 &&
    p.purchase_units[0].amount?.currency_code === "USD" &&
    p.purchase_units[0].amount?.value === (total / 100).toFixed(2)
  );
}

export function validRefund(value: unknown, total: number) {
  const r = value as {
    id?: string;
    status?: string;
    amount?: { currency_code?: string; value?: string };
  };
  return (
    typeof r?.id === "string" &&
    r.id.length > 0 &&
    r.id.length <= 100 &&
    r.status === "COMPLETED" &&
    r.amount?.currency_code === "USD" &&
    r.amount.value === (total / 100).toFixed(2)
  );
}
