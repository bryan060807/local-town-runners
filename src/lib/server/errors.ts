export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export type DatabaseOperation =
  | "save_application"
  | "submit_application"
  | "accept_customer_terms"
  | "review_application"
  | "moderate"
  | "confirm_payment"
  | "claim_payment_capture"
  | "attach_verified_paypal_order";
export class DatabaseOperationError extends Error {
  code?: string;
  constructor(
    error: unknown,
    public operation: DatabaseOperation,
  ) {
    super("Database operation failed");
    this.name = "DatabaseOperationError";
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      /^[A-Z0-9]{4,12}$/.test(error.code)
    )
      this.code = error.code;
  }
}
