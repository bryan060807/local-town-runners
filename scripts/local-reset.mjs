import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
if (process.argv[2] !== "--confirm-demo-reset")
  throw Error(
    "This deletes only the dedicated local demo containers and data. Run npm run local:reset -- --confirm-demo-reset to opt in.",
  );
const env = await readFile(".local-backend/app.env", "utf8");
if (!env.includes("NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n"))
  throw Error("Reset requires the dedicated loopback backend configuration");
const names = ["ltr-local-rest", "ltr-local-auth", "ltr-local-db"];
for (const name of names) {
  const r = spawnSync(
    "docker",
    ["inspect", name, "--format", "{{.Config.Image}}"],
    { encoding: "utf8" },
  );
  if (r.status !== 0)
    throw Error(
      `Expected local container ${name} is missing; no reset performed`,
    );
  const expected = name.endsWith("-db")
    ? "postgres:17-alpine"
    : name.endsWith("-auth")
      ? "supabase/gotrue:v2.186.0"
      : "postgrest/postgrest:v14.3";
  if (r.stdout.trim() !== expected)
    throw Error("Container identity mismatch; no reset performed");
}
const removed = spawnSync("docker", ["rm", "-f", "-v", ...names], {
  stdio: "inherit",
});
if (removed.status !== 0) process.exit(1);
for (const script of [
  "scripts/local-backend.mjs",
  "scripts/with-local-env.mjs",
]) {
  const r = spawnSync(
    process.execPath,
    script.includes("with-local")
      ? [script, "--script", "scripts/seed.ts"]
      : [script],
    { stdio: "inherit" },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log(
  "Dedicated local demo reset complete: clean orders/rewards, known accounts/listings, restored stock and fresh temporary runner trips. Hosted resources untouched.",
);
