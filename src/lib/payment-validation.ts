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
