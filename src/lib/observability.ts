/** Allowlisted metadata only. Never pass bodies, provider payloads, addresses or credentials. */
export function logEvent(
  event: string,
  fields: {
    stage?: string;
    status?: number;
    tool?: string;
    outcome?: string;
    code?: string;
  } = {},
) {
  console.info(JSON.stringify({ event, ...fields }));
}
export class ProviderError extends Error {
  constructor(
    public provider: "paypal" | "ai",
    public stage: string,
    public status?: number,
  ) {
    super(`${provider} ${stage} unavailable`);
    this.name = "ProviderError";
  }
}
