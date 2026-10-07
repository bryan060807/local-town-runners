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
const child = spawn(
  process.execPath,
  [
    "--use-env-proxy",
    "--use-system-ca",
    "node_modules/next/dist/bin/next",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: { ...process.env, ...values } },
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
