import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
const values = Object.fromEntries(
  (await readFile(".local-backend/app.env", "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const args = process.argv.slice(2);
const target =
  args[0] === "--script"
    ? ["--import", "tsx", ...args.slice(1)]
    : ["node_modules/next/dist/bin/next", ...args];
const child = spawn(
  process.execPath,
  ["--use-env-proxy", "--use-system-ca", ...target],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      RESEND_API_KEY: "",
      ONBOARDING_EMAIL_FROM: "",
      ONBOARDING_EMAIL_TO: "",
      RESEND_WEBHOOK_SECRET: "",
      CRON_SECRET: "",
      PAYPAL_CLIENT_ID: "",
      PAYPAL_CLIENT_SECRET: "",
      PAYPAL_WEBHOOK_ID: "",
      AI_API_KEY: "",
      AI_MODEL: "",
      ...values,
    },
  },
);
child.on("error", () => {
  console.error("Could not start local application process");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
